# 🐟 JobScout

**Find jobs and internships that match your profile — powered by [TinyFish](https://tinyfish.ai).**

JobScout lets you paste your raw profile information (skills, education, experience, interests) and automatically searches live job listings from LinkedIn Jobs, Indeed, and Internshala using the TinyFish Web Agent API.

![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- 🔍 **Smart keyword extraction** — Automatically detects skills, technologies, and role titles from your profile text
- 🌐 **Multi-board scraping** — Searches LinkedIn Jobs, Indeed, and Internshala in parallel
- 🤖 **AI-powered extraction** — TinyFish Web Agent navigates real job boards and extracts structured listings
- 🎨 **Modern UI** — Clean, responsive design with dark mode support
- ⚡ **Structured output** — Uses TinyFish `output_schema` for reliable JSON results
- 🔒 **Secure** — API key stays server-side, never exposed to the browser

## Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/your-username/jobscout.git
   cd jobscout
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Add your TinyFish API key**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and replace `your_key_here` with your actual API key from [agent.tinyfish.ai/api-keys](https://agent.tinyfish.ai/api-keys).

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open** [http://localhost:3000](http://localhost:3000) in your browser.

### Development mode (auto-restart on file changes)

```bash
npm run dev
```

## Tech Stack

| Layer    | Tech                          |
| -------- | ----------------------------- |
| Backend  | Node.js + Express             |
| Frontend | Vanilla HTML / CSS / JS       |
| API      | TinyFish Web Agent (sync)     |
| Font     | Inter (Google Fonts)          |

## File Structure

```
jobscout/
├── server.js          # Express server + /api/search endpoint
├── scrapeJobs.js      # TinyFish API calls (all in one place)
├── public/
│   ├── index.html     # Single-page frontend
│   ├── style.css      # Styles (light + dark mode)
│   └── app.js         # Frontend JS logic
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## How It Works

1. You paste your profile info (skills, education, interests, etc.)
2. The backend extracts keywords and a likely role title
3. TinyFish Agent navigates job boards with those keywords
4. Results are normalized into clean cards with title, company, location, and an Apply link
5. All scraping happens server-side — your API key is never exposed

## License

MIT
