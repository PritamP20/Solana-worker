import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import * as borsh from 'borsh';
import cron from 'node-cron';
import fs from 'fs';

// This is a simple scheduler that will call our program at 11pm every day
// Replace with your actual program ID after deployment
const PROGRAM_ID = 'YOUR_PROGRAM_ID_HERE';

// Load your keypair - in production use a more secure method
// This assumes you have a keypair.json file
const loadKeypair = () => {
  const keypairData = JSON.parse(fs.readFileSync('keypair.json', 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
};

class TimeInstruction {
  constructor(properties) {
    this.unix_timestamp = properties.unix_timestamp;
  }
}

const schema = new Map([
  [TimeInstruction, { kind: 'struct', fields: [['unix_timestamp', 'i64']] }]
]);

// Function to send the "Good night" transaction
async function sendGoodNightTransaction() {
  try {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const payer = loadKeypair();
    
    // Current timestamp
    const now = Math.floor(Date.now() / 1000);
    
    // Serialize the instruction data
    const instruction = new TimeInstruction({ unix_timestamp: now });
    const data = borsh.serialize(schema, instruction);
    
    // Create the transaction instruction
    const txInstruction = new TransactionInstruction({
      keys: [],
      programId: new PublicKey(PROGRAM_ID),
      data: Buffer.from(data)
    });
    
    // Create and send the transaction
    const transaction = new Transaction().add(txInstruction);
    const signature = await connection.sendTransaction(transaction, [payer]);
    
    console.log(`Transaction sent at ${new Date().toISOString()}`);
    console.log(`Signature: ${signature}`);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature);
    console.log('Transaction confirmed!');
  } catch (error) {
    console.error('Error sending transaction:', error);
  }
}

// Schedule the job to run at 11:00 PM every day
cron.schedule('0 23 * * *', () => {
  console.log('Running scheduled task at 11:00 PM');
  sendGoodNightTransaction();
});

console.log('Scheduler started. Will send "Good night" transaction at 11:00 PM every day.');
