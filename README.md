# 🕳️ Rabbit Hole Studio

[![Live Demo](https://img.shields.io/badge/Live_Demo-Play_Now-blue?style=for-the-badge)](https://rabbithole-rose.vercel.app)

An impossibly sleek, AI-powered graph explorer built to help you tumble down internet rabbit holes without the noise. 

Start with a single topic, let the AI generate hyper-relevant connections, and merge multiple ideas to deduce common overlaps—all laid out on a stunning, minimalist canvas.

---

## ✨ Features

- **Premium Minimalist UI**: Enjoy a modern, distraction-free "dark studio" aesthetic with floating command docks, glassmorphism, and color-coded content.
- **Precision Topic Seeding**: Enter a single topic—any topic—and our fine-tuned logic ensures you won't get hallucinated nonsense or unrelated Wikipedia articles. The AI sticks *strictly* to your prompt.
- **Controlled Expansions**: You dictate how many new nodes branch off of a topic (1-6).
- **Logical Deductions (Overlap generation)**: Join 2 or more nodes together and the AI will logically deduce shared themes, linguistic roots, or conceptual commonalities instead of guessing random elements.
- **Deep Inspector Insights**: Click on any node to view a sliding side-panel with timelines, curiosity paths, source hints, controversies, and the specific reason why that connection exists.

---

## 🛠️ Tech Stack

- **Next.js 16** (React)
- **Tailwind CSS v4** (Ultra-minimalist Zinc Palette)
- **React Flow** (Interactive Node Canvas)
- **Groq API** (Llama-3.1-8b-instant LLM for lightning-fast inference)

---

## 🚀 Quick Setup Guide

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed on your machine.

### 2. Getting a **Free** Groq API Key
This project uses Groq's insanely fast cloud interface for LLM operations.
1. Head over to [console.groq.com](https://console.groq.com/).
2. Sign up or log into your account.
3. In the left-hand sidebar, navigate to the **API Keys** section.
4. Click **Create API Key**.
5. Copy the generated key (it usually starts with `gsk_...`). 
*(Note: Keep this key safe and do not share it publicly!)*

### 3. Installation
Clone or download this repository, then run the following in your terminal to install dependencies:
```bash
npm install
```

### 4. Environment Configuration
Copy the sample environment file to create your local `.env` setup:
```bash
cp .env.example .env.local
```
Open `.env.local` and paste your Groq key into it:
```env
GROQ_API_KEY=gsk_your_api_key_goes_here
GROQ_MODEL=llama-3.1-8b-instant
DISCORD_WEBHOOK_URL=your_discord_webhook_url_here
```
*(Note: If you want to track activity, provide a Discord webhook URL. The app will send a notification whenever someone uses the tool!)*

### 5. Start the Studio
Start the local development server:
```bash
npm run dev
```
Open a browser and navigate to **[http://localhost:3000](http://localhost:3000)** to start exploring!

---

## 📖 How to Use the App (Tutorial)

1. **Seed a Topic:**
   - Look at the floating dock at the bottom of the screen.
   - Click the search bar, type a topic (e.g., `Minecraft`, `Cold War`, or even your own name), and hit **Enter** or click **Add**.
   - A single, live node will drop onto your canvas.

2. **Expand the Node:**
   - On the top left of the screen, you can adjust the "Expand" count (e.g., set it to `3`).
   - Click on your newly created node. A side inspector panel will slide out.
   - Click the **Expand** button inside the inspector (or directly on the node card). You will see 3 related topics branch out perfectly from the original!

3. **Join Nodes Together (Deduction Overlap):**
   - Let's say you have two different nodes on your board (for example, `Taylor Swift` and `Minecraft`).
   - Click on the first node, and in the inspector panel, click **Queue Join**.
   - Click on the second node and do the same.
   - Look at the bottom command dock and click **Join (2)**.
   - The AI will logically deduce what those two topics have in common and generate a single bridge node spanning between them.

4. **Navigate the Canvas:**
   - Use your scroll wheel to zoom in and out.
   - Click and drag an empty area to pan around the infinite canvas.
   - You can move the individual nodes anywhere you want!

---

## ☁️ Deployment

Want to host this online? The easiest way is using Vercel.
1. Push your repository to GitHub.
2. Link the repository to your [Vercel Dashboard](https://vercel.com).
3. Under Environment Variables, add your `GROQ_API_KEY`.
4. (Optional) Add your `DISCORD_WEBHOOK_URL` to know what nodes users are generating.
5. Hit Deploy! 

*Enjoy wandering down the rabbit hole!* 🕳️🐇
