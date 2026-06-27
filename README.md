```text
📁 Project Structure
pdf-to-slides/
│
├── backend/                        # FastAPI Python backend
│   ├── app/
│   │   ├── __init__.py             # ← Required: marks app as Python package
│   │   ├── main.py                 # FastAPI entry point + CORS + routes
│   │   │
│   │   ├── routers/
│   │   │   ├── __init__.py         # ← Required: marks folder as package
│   │   │   └── convert.py          # POST /api/convert  GET /api/download/{id}
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py         # ← Required: marks folder as package
│   │   │   ├── pdf_parser.py       # PyMuPDF: extract text from each PDF page
│   │   │   ├── groq_service.py     # Groq API: summarize pages → slide content
│   │   │   └── slide_builder.py    # python-pptx: build branded .pptx file
│   │   │
│   │   ├── models/
│   │   │   ├── __init__.py         # ← Required: marks folder as package
│   │   │   └── schemas.py          # Pydantic request/response models
│   │   │
│   │   └── utils/
│   │       ├── __init__.py         # ← Required: marks folder as package
│   │       └── file_handler.py     # Save uploads, get output paths, cleanup
│   │
│   ├── uploads/                    # Temp PDF storage (auto-created, git-ignored)
│   ├── outputs/                    # Generated .pptx files (auto-created, git-ignored)
│   ├── .env.example                # Copy this to .env and fill in your keys
│   ├── requirements.txt            # Python dependencies
│   └── Dockerfile                  # For containerized deployment
│
├── frontend/                       # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx                 # Main app + state machine (idle/upload/done/error)
│   │   ├── App.css                 # All styles (dark theme, design tokens)
│   │   ├── main.jsx                # React DOM entry point
│   │   │
│   │   ├── components/
│   │   │   ├── UploadZone.jsx      # Drag-and-drop PDF upload area
│   │   │   ├── ProgressBar.jsx     # 4-stage animated progress indicator
│   │   │   ├── SlidePreview.jsx    # Grid preview of generated slides
│   │   │   └── DownloadButton.jsx  # Styled download link for .pptx
│   │   │
│   │   └── services/
│   │       └── api.js              # Axios: POST /api/convert + download URL
│   │
│   ├── index.html                  # HTML shell
│   ├── vite.config.js              # Vite config + dev proxy to backend
│   ├── package.json                # Node dependencies
│   └── .env.example                # Copy this to .env and fill in your URL
│
├── .gitignore
└── README.md
```

🚀 Quick Start (Local Development)
Prerequisites

Tool    Version    Download
Python  3.10+      https://python.org
Node.js 18+        https://nodejs.org
Git     any        https://git-scm.comGroq 
API Key free       https://console.groq.com

1. Clone the repository

bashgit clone https://github.com/YOUR_USERNAME/pdf-to-slides.git
cd pdf-to-slides

2. Backend Setup

bashcd backend

Create virtual environment:

bash# Windows
python -m venv venv
.\venv\Scripts\activate

# Mac / Linux
python3 -m venv venv
source venv/bin/activate

Install dependencies:

bashpip install -r requirements.txt

Set up environment variables:

bash# Windows
copy .env.example .env

# Mac / Linux
cp .env.example .env

Now open .env and add your Groq API key:

envGROQ_API_KEY=your_groq_api_key_here
BASE_URL=http://localhost:8000

🔑 Get a free Groq API key at https://console.groq.com → API Keys → Create

Run the backend:

bashuvicorn app.main:app --reload --port 8000

✅ Visit http://localhost:8000 — you should see:

json{ "status": "running", "message": "PDF to Slides API is live" }

✅ Visit http://localhost:8000/api/health — you should see:

json{ "status": "ok", "groq_key_set": true }

3. Frontend Setup

Open a new terminal (keep backend running):

bashcd frontend

Install dependencies:

bashnpm install

Set up environment variables:

bash# Windows
copy .env.example .env

# Mac / Linux
cp .env.example .env

.env should contain:

envVITE_API_URL=http://localhost:8000

Run the frontend:

bashnpm run dev

✅ Visit http://localhost:5173 — you should see the SlideAI interface.

✅ How to Use


Open http://localhost:5173
Drag and drop a PDF (or click to browse)
Click Generate Slides
Wait ~10–30 seconds for AI to process
Preview your slides and click Download .pptx
Open in PowerPoint, Google Slides, or LibreOffice

 Deployment (Free)

Backend → Render

Step 1 — Push your code to GitHub first

bashgit add .
git commit -m "deploy"
git push

Step 2 — Create a Web Service on Render


Go to https://render.com and sign in
Click New → Web Service
Connect your GitHub repo → select pdf-to-slides
Fill in these settings:


SettingValueNamepdf-to-slides-apiRoot DirectorybackendRuntimePython 3Build Commandpip install -r requirements.txtStart Commanduvicorn app.main:app --host 0.0.0.0 --port $PORTInstance TypeFree

Step 3 — Add Environment Variables

In Render dashboard → your service → Environment tab → add:

GROQ_API_KEY = your_groq_api_key_here
BASE_URL     = https://your-app-name.onrender.com

Step 4 — Deploy

Click Create Web Service — Render will build and deploy automatically.

✅ Your backend URL will be: https://your-app-name.onrender.com


⚠️ Render Free Tier note: The service spins down after 15 minutes of inactivity and takes ~30 seconds to wake up on the next request. This is normal on the free plan.

Frontend → Vercel

Step 1 — Deploy

bashnpm i -g vercel
cd frontend
vercel --prod

Or connect your GitHub repo directly at https://vercel.com/new

SettingValueRoot DirectoryfrontendFramework PresetViteBuild Commandnpm run buildOutput Directorydist

Step 2 — Add Environment Variable

In Vercel dashboard → your project → Settings → Environment Variables, add:

VITE_API_URL = https://your-app-name.onrender.com


⚠️ Make sure there is no trailing slash at the end of the URL.

Step 3 — Redeploy

Go to Deployments tab → click the 3 dots → Redeploy so the env variable takes effect.

✅ Your app is live!

⚙️ Tech Stack

Layer             Technology                        Purpose
Frontend          React + Vite                      UI  
Styling           Plain CSS (custom dark theme)     Design
Backend           FastAPI (Python)                  API server
PDF Parsing       PyMuPDF (fitz)                    Extract text per page
AI                Groq API — LLaMA 3 8B             Summarize → slide content
Slide Generation  python-pptx                       Build branded .pptx
HTTP Client       Axios                             Frontend → backend calls
Deployment FE     Vercel                            Free hosting
Deployment BE     Render                            Free hosting

❓ Troubleshooting
Problem                                                       Fix
ProblemFixModuleNotFoundError: No module named 'app'          Run uvicorn from inside backend/ folder, not from backend/app/
SyntaxError: source code string cannot contain null bytes     File was corrupted by Windows echo. Rewrite using Set-Content -Encoding utf8
Attribute "app" not found in module "app.main"                Your main.py is empty or missing app = FastAPI(...)
Frontend blank white page                                     Check all src/ files have content (0 bytes = empty file, paste content manually)
groq_key_set: false                                           Your .env file is missing or GROQ_API_KEY is not set
CORS error in browser                                         Make sure BASE_URL in backend .env matches your frontend URL

📌 Important Notes
__init__.py files must exist in every app/ subfolder — even if empty. They are required Python packaging markers. Do not delete them.
.env files are git-ignored for security. Never commit real API keys.

uploads/ and outputs/ folders are auto-created at runtime and git-ignored.
Free Groq tier supports ~14,400 requests/day on LLaMA 3 8B.
PDFs are capped at 20 pages per conversion to stay within Groq limits.

📄 License
MIT — free to use, modify, and distribute.
