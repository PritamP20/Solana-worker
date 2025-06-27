# REVA Social Media Solana Program

A decentralized social media management program for REVA University, supporting Admin, Teacher, and User roles.

## Features

- **Admin**: Add/remove teachers and users, moderate/delete posts and comments.
- **Teacher**: Post announcements, assignments, moderate comments on their posts.
- **User**: Create posts, comment, like content, follow teachers/users.

## Usage

- Build: `cargo build-sbf`
- Test: Write tests in `index.test.ts` and run with `bun test`
- Deploy: `solana program deploy ./target/deploy/reva_social.so`

## Accounts

- UserProfile: Stores user info and role.
- Post: Stores post content and author.
- Comment: Stores comment content, author, and parent post.

## Instructions

- `InitUser { name, role }`
- `CreatePost { content }`
- `CreateComment { post, content }`
- `DeletePost`
- `DeleteComment`
  