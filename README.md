# Bolt - P2P WebRTC File Transfer

A high-speed, direct browser-to-browser encrypted file and clipboard sharing app built with WebRTC.

- **Zero Cloud Storage**: Direct device-to-device transfers.
- **No Size Limits**: Stream multi-gigabyte files and folders.
- **Zero-RAM Streaming**: Direct-to-disk write using the File System Access API.
- **64KB Chunks with Smart Flow Control**: High throughput with backpressure handling.
- **End-to-End Cryptography**: SHA-256 integrity verification and DTLS/SRTP encryption.
- **Ephemeral Text Relay**: Instant sharing of passwords, links, and notes.

---

## 🚀 How to Deploy to GitHub & Cloudflare Pages (`*.pages.dev`)

### Step 1: Initialize Git and Push to GitHub

In your local project folder:

```bash
# Initialize git repository
git init

# Add all files
git add .

# Commit your changes
git commit -m "Initial commit of Bolt P2P file transfer app"

# Rename branch to main
git branch -M main

# Link to your GitHub repository (replace with your repo URL)
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO_NAME>.git

# Push to GitHub
git push -u origin main
```

---

### Step 2: Deploy to Cloudflare Pages (`pages.dev`)

1. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and sign in or create a free account.
2. In the left sidebar, click **Workers & Pages**.
3. Click **Create Application** > select the **Pages** tab > click **Connect to Git**.
4. Authorize Cloudflare with your GitHub account and select your repository.
5. In the **Set up builds and deployments** section:
   - **Framework preset**: Select `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: Leave blank (`/`)
   - **Environment variables (Optional)**:
     - `NODE_VERSION`: `20` (recommended)
6. Click **Save and Deploy**.

Within 1-2 minutes, Cloudflare Pages will build and deploy your app at:
`https://<project-name>.pages.dev`
