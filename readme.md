 Expense Tracker
A lightweight personal expense tracking web app built with FastAPI and Vanilla JS — no frontend framework, no ORM, just clean fundamentals.
🚀 How to Run
Prerequisites
• Python 3.10+
• Git
Steps
# 1. Clone the repo
git clone https://github.com/s1nansinnu/expense-tracker.git
cd expense-tracker

# 2. Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Start the server
cd backend
uvicorn main:app --reload

5.  Open http://127.0.0.1:8000 in your browser

Backens- FastAPI -Auto docs, Pydantic validation, async-ready
Database - SQLite - Zero setup, file-based, good for single-user apps
ORM - None (raw SQL) - Full control, no abstraction overhead
Frontend -Vanilla JS -No build step, fast load, keeps it simple
Styling -Plain CSS -Custom variables, no framework bloat
Server -Uvicorn -ASGI server, pairs naturally with FastAPI

Trade-offs
Chose SQLite over PostgreSQL
No server to run, easy to ship and demo
Not suitable for multi-user or production deployments
Chose Vanilla JS over React
No build toolchain, instant load, easy to read
State management gets messy as features grow
Chose raw SQL over SQLAlchemy
Transparent queries, no magic, easy to debug
More boilerplate for complex queries
WAL mode enabled on SQLite
Better read concurrency
Still not a replacement for a real DB under load

 Known Rough Edges
• No pagination — loading thousands of expenses will slow the table down
• Date stored as TEXT in SQLite (YYYY-MM-DD) — works fine but not a native date type
• No input sanitization beyond Pydantic — SQL injection is handled by parameterized queries, but no HTML sanitization on notes
• Static files must be inside backend/static/ — moving files outside that folder breaks the app without changing main.py
• Single SQLite file — concurrent writes from multiple tabs can queue up under WAL, but heavy use isn't the target
• No error boundary on the frontend — a failed API call shows an inline message but doesn't recover state automatically

Project Structure
expense_tracker/
├── backend/
│   ├── static/
│   │   ├── index.html
│   │   ├── app.js
│   │   └── style.css
│   ├── main.py        # FastAPI routes
│   ├── database.py    # SQLite CRUD helpers
│   ├── models.py      # Pydantic schemas
│   └── expenses.db    # Auto-created SQLite DB
├── venv/
├── requirements.txt
└── README.md