const url = 'https://tksruuqtzxflgglnljef.supabase.co/functions/v1/generate-report';

const headers = {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrc3J1dXF0enhmbGdnbG5samVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzY0OTIsImV4cCI6MjA4Nzk1MjQ5Mn0.eu6LwoP-9O5sG9nHhBza0UgYHCOm7Ni5flk_1Lgl4FU',
    'Content-Type': 'application/json'
};

const body = JSON.stringify({
    student: { name: "Test", grade: "12th", subjects: "Math" },
    attendance: { total: 10, present: 10, absent: 0, late: 0, rate: 100 },
    batches: [],
    marks: []
});

async function run() {
    try {
        const res = await fetch(url, { method: 'POST', headers, body });
        const text = await res.text();
        console.log(`Status: ${res.status}`);
        console.log(`Response: ${text}`);
    } catch (e) {
        console.error(e);
    }
}
run();
