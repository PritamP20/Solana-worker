import express from "express";
import cors from "cors";
import { Connection, clusterApiUrl, Keypair } from '@solana/web3.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

const app = express();
app.use(cors());
app.use(express.json());

const execAsync = promisify(exec);

const NETWORKS = {
    devnet: clusterApiUrl('devnet'),
    testnet: clusterApiUrl('testnet'),
    mainnet: clusterApiUrl('mainnet-beta')
};

const execPromise = (cmd) =>
  new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(stderr || error);
      } else {
        resolve(stdout);
      }
    });
  });

app.get('/programId', async (req, res) => {
    const { network = 'devnet' } = req.query ;
    
    if (!NETWORKS[network]) {
        return res.status(400).json({ error: 'Invalid network specified' });
    }

    try {
        console.log("Getting the contract solana_program.so");
        const filePathSO = `../project/target/deploy/solana_escrow.so`;
        const filePathKeyPair = `../project/target/deploy/solana_escrow-keypair.json`;

        if (!fs.existsSync(filePathSO) || !fs.existsSync(filePathKeyPair)) {
            await execAsync(`cargo build-sbf --manifest-path ./project/Cargo.toml`);
        }
        
        if (!fs.existsSync(filePathSO) || !fs.existsSync(filePathKeyPair)) {
            return res.status(500).json({ error: 'Failed to build the contract' });
        }

        const fileKeypair = await fs.promises.readFile(filePathKeyPair, 'utf-8');
        const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fileKeypair)));
        const programId = keypair.publicKey.toString();
        console.log("Program ID:", programId);

        res.json({
            success: true,
            programBinary: fileKeypair, 
            programId: programId,
            network
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Failed to get the contract' });
    }
});

app.post('/finalize-deployment', async (req, res) => {
  console.log("deployined in devnet")
  try {
    const { network = 'devnet' } = req.body;

    if (!NETWORKS[network]) {
      console.log("network")
      return res.status(400).json({ error: 'Invalid network specified' });
    }

    try {
      await execAsync("solana address");
    } catch (error) {
      console.log(error)
      return res.status(400).json({ message: "No wallet found. Run 'solana-keygen new' or configure one." });
    }

    const filePathSO = `../project/target/deploy/solana_escrow.so`;
    const filePathKeyPair = `../project/target/deploy/solana_escrow-keypair.json`;

    if (!fs.existsSync(filePathSO) || !fs.existsSync(filePathKeyPair)) {
      console.log("file path wrong")
      return res.status(400).json({ error: 'Program build artifacts not found' });
    }

    let { stdout: balanceOutput } = await execAsync("solana config set --url https://api.devnet.solana.com && solana balance");
    console.log(balanceOutput)
    const solBalance = parseFloat(balanceOutput.trim());

    if (solBalance < 1) {
      console.log(`Balance low (${solBalance} SOL). Requesting airdrop...`);
      await execAsync("solana airdrop 5");
    }

    const deployCommand = `solana program deploy ${filePathSO} --keypair ./my-keypair.json --url ${NETWORKS[network]}`;
    console.log('Deploying program...');

    const { stdout: deployOutput, stderr } = await execAsync(deployCommand);

    if (stderr) console.error('stderr:', stderr);

    const programIdMatch = deployOutput.match(/Program Id: (\w+)/);
    const deployedProgramId = programIdMatch ? programIdMatch[1] : null;

    if (!deployedProgramId) {
      console.log("program id error")
      return res.status(500).json({ error: 'Failed to extract Program ID' });
    }

    res.json({
      success: true,
      transactionLog: deployOutput,
      programId: deployedProgramId,
      message: `Program deployed to ${network}`
    });

  } catch (error) {
    console.error('Deployment error:', error);
    res.status(500).json({ error: 'Failed to deploy program' });
  }
});

app.get('/download-project', async (req, res) => {
  const folderPath = path.resolve('../project'); // Absolute path is safer
  const zipName = req.query.name || 'project.zip'; // You can pass `?name=myproject.zip`

  console.log("Creating ZIP file:", zipName);

  res.setHeader('Content-Disposition', `attachment; filename=${zipName}`);
  res.setHeader('Content-Type', 'application/zip');

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);

  // Add all files except node_modules
  archive.glob('**/*', {
    cwd: folderPath,
    ignore: ['node_modules/**']
  });

  archive.finalize();
});



app.post("/create-wallet", async (req, res) => {
  console.log("creatig wallet")
  const keypairPath = "./my-keypair.json";

  // Check if the keypair file exists
  if (fs.existsSync(keypairPath)) {
    let keypairFile = fs.readFileSync(keypairPath);
    return res.json({ keypair: keypairFile });
  }

  // Generate a new keypair
  const cmd = "solana-keygen new --outfile ./my-keypair.json --force --no-bip39-passphrase && solana config set --keypair ./my-keypair.json";
  try {
    const strout = await execPromise(cmd); // Wait for keypair generation to complete
    console.log(strout)
    let keypairFile = fs.readFileSync(keypairPath);
    if (keypairFile) {
      return res.json({ keypair: keypairFile});
    }
    return res.json({ message: `Keypair generated successfully: ${strout}` });
  } catch (error) {
    return res.status(500).json({ error: `Error: ${error}` });
  }
});
app.get('/keypair', async (req, res) => {
  try {
    const filePath = path.resolve('./my-keypair.json'); 
    const zipName = req.query.name || 'keypair.zip';

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Keypair file not found' });
    }

    console.log("Creating ZIP file:", zipName);

    res.setHeader('Content-Disposition', `attachment; filename=${zipName}`);
    res.setHeader('Content-Type', 'application/zip');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    archive.file(filePath, { name: 'my-keypair.json' });

    await archive.finalize(); 

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: `${error}` });
  }
});


app.post("/write-file", async (req, res) => {
  try {
    const projectDir = path.resolve("../project");

    const { relativePath, content } = req.body;

    if (!relativePath || typeof content !== "string") {
      return res.status(400).json({ error: "Missing relativePath or content" });
    }

    const filePath = path.resolve(projectDir, relativePath);

    // ⛔ Security check to prevent writing outside project folder
    if (!filePath.startsWith(projectDir)) {
      return res.status(403).json({ error: "Invalid file path" });
    }

    // 🏗️ Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });

    // 📝 Write file
    await fs.promises.writeFile(filePath, content, "utf-8");
    console.log(`✅ Wrote file: ${filePath}`);

    res.json({ success: true, message: `File written to ${relativePath}` });
  } catch (error) {
    console.error("❌ Error writing file:", error);
    res.status(500).json({ error: error.message });
  }
});


app.post("/clear-files", async (req, res) => {
  try {
    const projectDir = path.resolve("../project");
    const filesToClear = [
      path.join(projectDir, "src/lib.rs"),
      path.join(projectDir, "index.test.ts"),
    ];

    for (const filePath of filesToClear) {
      if (!filePath.startsWith(projectDir)) {
        return res.status(403).json({ error: `Invalid file path: ${filePath}` });
      }

      if (fs.existsSync(filePath)) {
        await fs.promises.writeFile(filePath, "", "utf-8");
        console.log(`🧹 Cleared: ${filePath}`);
      } else {
        console.log(`⚠️ File not found: ${filePath}`);
      }
    }

    // 🔥 Remove target directory if it exists
    const targetDir = path.join(projectDir, "target");
    if (fs.existsSync(targetDir)) {
      await fs.promises.rm(targetDir, { recursive: true, force: true });
      console.log(`🗑️ Deleted target directory: ${targetDir}`);
    } else {
      console.log(`⚠️ target/ not found`);
    }

    res.json({
      success: true,
      message: "Files cleared and target directory removed.",
    });
  } catch (error) {
    console.error("❌ Error in clear-files:", error);
    res.status(500).json({ error: error.message });
  }
});



app.listen(3001, ()=>{
  console.log("server started at 3001")
})