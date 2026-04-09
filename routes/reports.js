const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const DATA_PATH = req.app.locals.getDataPath();
        if (!DATA_PATH) return res.status(400).json({ success: false, error: 'Configuration manquante' });

        const { type, date } = req.body;
        const targetDate = new Date(date);
        const report = { type, date, tasks: [], summary: {}, dailyTotals: {}, weeklyTotal: 0 };

        if (type === 'daily') {
            const year = targetDate.getFullYear();
            const month = String(targetDate.getMonth() + 1).padStart(2, '0');
            const day = String(targetDate.getDate()).padStart(2, '0');
            const filePath = path.join(DATA_PATH, String(year), month, `${day}.txt`);

            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const lines = content.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim());
                for (const line of lines) {
                    const match = line.trim().match(/^(\d{2}:\d{2})\s+(.+)$/);
                    if (match) report.tasks.push({ time: match[1], description: match[2] });
                }
            } catch (error) {}
        } else if (type === 'weekly' || type === 'monthly') {
            let startDate, endDate;

            if (type === 'weekly') {
                const dayOfWeek = targetDate.getDay();
                const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                startDate = new Date(targetDate);
                startDate.setDate(targetDate.getDate() + diffToMonday);
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
            } else {
                startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
                endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
            }

            const currentDate = new Date(startDate);
            const categoryTotals = {};

            while (currentDate <= endDate) {
                const year = currentDate.getFullYear();
                const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                const day = String(currentDate.getDate()).padStart(2, '0');
                const filePath = path.join(DATA_PATH, String(year), month, `${day}.txt`);

                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    const lines = content.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim());
                    const dayTasks = [];
                    const dayProjectTotals = {};
                    let dayTotalMinutes = 0;

                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        const match = line.trim().match(/^(\d{2}:\d{2})\s+(.+)$/);
                        if (!match) continue;

                        const time = match[1];
                        const description = match[2];
                        const parts = description.split(' ');
                        const category = parts[parts.length - 1];

                        let duration = 0;
                        if (i < lines.length - 1) {
                            const nextMatch = lines[i + 1].trim().match(/^(\d{2}:\d{2})\s+(.+)$/);
                            if (nextMatch) {
                                const [h1, m1] = time.split(':').map(Number);
                                const [h2, m2] = nextMatch[1].split(':').map(Number);
                                duration = (h2 * 60 + m2) - (h1 * 60 + m1);
                            }
                        }

                        dayTasks.push({ time, description, duration });

                        if (duration > 0 && !description.toLowerCase().includes('pause')) {
                            if (!categoryTotals[category]) categoryTotals[category] = 0;
                            categoryTotals[category] += duration;
                            dayTotalMinutes += duration;

                            const projectKey = `${description}_${category}`;
                            if (!dayProjectTotals[projectKey]) {
                                dayProjectTotals[projectKey] = { description, category, duration: 0 };
                            }
                            dayProjectTotals[projectKey].duration += duration;
                        }
                    }

                    if (dayTasks.length > 0) {
                        const dayOfWeek = currentDate.getDay();
                        const expectedMinutes = dayOfWeek === 5 ? 240 : 465;
                        const delta = dayTotalMinutes - expectedMinutes;

                        report.tasks.push({
                            date: `${day}/${month}/${year}`,
                            year, month, day, tasks: dayTasks,
                            projectTotals: Object.values(dayProjectTotals),
                            totalMinutes: dayTotalMinutes,
                            deltaMinutes: delta
                        });

                        report.dailyTotals[`${year}-${month}-${day}`] = { totalMinutes: dayTotalMinutes, deltaMinutes: delta };
                        report.weeklyTotal += dayTotalMinutes;
                    }
                } catch (error) {}

                currentDate.setDate(currentDate.getDate() + 1);
            }

            report.summary = categoryTotals;
        }

        res.json({ success: true, report });
    } catch (error) {
        console.error('Erreur rapport:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
