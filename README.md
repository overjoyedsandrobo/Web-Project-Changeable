# Changeable

Changeable is an interactive, rule‑based generative canvas where users shape an abstract preview by editing a grid. It’s designed as a portfolio project to showcase UI, frontend logic, and backend persistence.

## What It Does
- Paint a grid using rules (12 rule types)
- Generate abstract previews from the grid + seed
- Save designs to a database (public or private)
- Browse public designs or your private gallery
- Log in to keep your work across sessions

## Tech Stack
- Flask
- SQLite
- Vanilla JS + HTML/CSS

## Run Locally
1. Install dependencies:
   ```bash
   pip install -r Changeable/requirements.txt
   ```
2. Run the app:
   ```bash
   python Changeable/app.py
   ```
3. Open:
   `http://127.0.0.1:5000`

## Usage Tips
- Click a rule in the legend, then paint on the grid.
- Right‑click a legend rule to change its color (colors are user‑specific).
- Use **Generate** to preview a new variation.
- Save to **Public** to share, or **Private** to keep it personal.

## Goals
This project focuses on creative exploration and interaction design. The grid acts as a control field for generative output — not a literal pixel editor.
