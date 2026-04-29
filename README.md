# DeepThought HRMS Assignment

## Setup Instructions
1. Clone the repo: `git clone <your-fork-url>`
2. Install backend: `cd backend && npm install`
3. Install frontend: `cd frontend && npm install`
4. Add `.env` in backend:
   MONGO_URI=your_mongodb_connection_string
   PORT=5000
5. Run backend: `npm start`
6. Run frontend: `cd frontend && npm start`

## HRMS Chosen
MERN Employee Salary Management — chosen for its clean payroll-focused structure and
familiar React + Express + MongoDB stack that matches the assignment context.

## AI Tools Used
- Claude (claude.ai): Used for scaffolding the Overtime feature component, writing backend
  validation logic, and the CSV export utility. Manually reviewed all validation edge cases
  (especially the 7-day date window and monthly cap logic) and corrected the date comparison
  logic which initially used local time instead of UTC.
- GitHub Copilot: Autocomplete during repetitive ticket fixes.

## Notes on Tickets
- LF-105: Chose horizontal scroll over stacked layout as it preserves all data visibility
  without requiring major restructure of the existing table component.
