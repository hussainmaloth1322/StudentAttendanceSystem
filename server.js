const express = require('express');
const path = require('path');
const db = require('./database/db');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
function validPeriod(value) {
  return Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 7;
}

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/students', async (req, res, next) => {
  try { res.json(await db.getStudents()); } catch (e) { next(e); }
});

app.post('/api/students', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const rollNo = String(req.body.roll_no || '').trim();
    const department = String(req.body.department || '').trim();
    if (!name || !rollNo) return res.status(400).json({ error: 'Roll number and student name are required.' });
    const result = await db.addStudent({ roll_no: rollNo, name, department });
    res.status(201).json(result);
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT' || /UNIQUE constraint failed/i.test(e.message)) {
      return res.status(409).json({ error: 'That roll number already exists.' });
    }
    next(e);
  }
});

app.put('/api/students/:rollNo', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const department = String(req.body.department || '').trim();
    if (!name) return res.status(400).json({ error: 'Student name is required.' });
    const changed = await db.updateStudent(req.params.rollNo, name, department);
    if (!changed) return res.status(404).json({ error: 'Student not found.' });
    res.json({ message: 'Student updated.' });
  } catch (e) { next(e); }
});

app.delete('/api/students/:rollNo', async (req, res, next) => {
  try {
    const changed = await db.deleteStudent(req.params.rollNo);
    if (!changed) return res.status(404).json({ error: 'Student not found.' });
    res.json({ message: 'Student and associated attendance deleted.' });
  } catch (e) { next(e); }
});

app.get('/api/attendance', async (req, res, next) => {
  try {
    const date = req.query.date;
    if (!validDate(date)) return res.status(400).json({ error: 'Provide date as YYYY-MM-DD.' });
    res.json(await db.getAttendance(date));
  } catch (e) { next(e); }
});

app.post('/api/attendance', async (req, res, next) => {
  try {
    const { date, records } = req.body;
    if (!validDate(date) || !Array.isArray(records)) return res.status(400).json({ error: 'Date and records array are required.' });
    for (const r of records) {
      if (!r.roll_no || !validPeriod(Number(r.period)) || !['Present', 'Absent'].includes(r.status)) {
        return res.status(400).json({ error: 'Each record needs roll_no, period 1–7, and status Present or Absent.' });
      }
    }
    await db.saveAttendance(date, records);
    res.json({ message: 'Attendance saved successfully.', count: records.length });
  } catch (e) { next(e); }
});

app.get('/api/reports/monthly', async (req, res, next) => {
  try {
    const month = String(req.query.month || '');
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'Provide month as YYYY-MM.' });
    const threshold = Math.min(100, Math.max(0, Number(req.query.threshold || 75)));
    res.json(await db.getMonthlyReport(month, threshold));
  } catch (e) { next(e); }
});

app.get('/api/reports/monthly.csv', async (req, res, next) => {
  try {
    const month = String(req.query.month || '');
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).send('Provide month as YYYY-MM.');
    const rows = await db.getMonthlyReport(month, Number(req.query.threshold || 75));
    const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = [['Roll Number', 'Student Name', 'Department', 'Working Periods', 'Present', 'Absent', 'Attendance %', 'Below Threshold'],
      ...rows.map(r => [r.roll_no, r.name, r.department, r.working_periods, r.present, r.absent, r.percentage, r.shortage ? 'Yes' : 'No'])]
      .map(row => row.map(csvCell).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${month}.csv"`);
    res.send(lines.join('\r\n'));
  } catch (e) { next(e); }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error. Check the server terminal for details.' });
});

if (require.main === module) {
  db.init().then(() => {
    app.listen(PORT, '0.0.0.0', () => console.log(`Student Attendance System running at http://localhost:${PORT}`));
  }).catch(err => {
    console.error('Database initialization failed:', err);
    process.exit(1);
  });
}
module.exports = app;
