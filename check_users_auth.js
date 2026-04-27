const fs = require('fs');

const SUPABASE_URL = 'https://tksruuqtzxflgglnljef.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrc3J1dXF0enhmbGdnbG5samVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzY0OTIsImV4cCI6MjA4Nzk1MjQ5Mn0.eu6LwoP-9O5sG9nHhBza0UgYHCOm7Ni5flk_1Lgl4FU';

async function main() {
    // 1. Login as teacher
    const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: 'demo.teacher@msgt.internal',
            password: 'Demo@1234'
        })
    });

    if (!loginRes.ok) {
        console.error("Login failed:", await loginRes.text());
        return;
    }
    const session = await loginRes.json();
    const token = session.access_token;

    // 2. Fetch all profiles
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=name,username,phone`, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${token}`
        }
    });
    
    if (!res.ok) {
        console.error("Failed to fetch from supabase", await res.text());
        return;
    }
    const profiles = await res.json();
    const dbNames = new Set(profiles.map(p => p.name?.toLowerCase().trim()).filter(Boolean));
    const dbPhones = new Set(profiles.map(p => p.phone?.trim()).filter(Boolean));
    const dbProfiles = profiles; // Keep for inspection

    // 3. Read CSV manually
    const fileContent = fs.readFileSync('C:\\Users\\ADMIN\\Downloads\\MSSC Registration Form (Responses) - Form Responses 1 (2).csv', 'utf8');
    const lines = fileContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    lines.shift(); // skip header
    
    let missingCount = 0;
    let foundCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split(',');
        const studentName = parts[1]?.trim();
        const studentNameLower = studentName?.toLowerCase();
        const phone = parts[3]?.trim();
        
        if (!studentName) continue;
        
        // Find if name exists in db
        const match = profiles.find(p => p.name?.toLowerCase().trim() === studentNameLower || (phone && p.phone === phone));
        
        if (match) {
            foundCount++;
        } else {
            missingCount++;
        }
    }
    
    console.log(`\nSummary: Found ${foundCount} out of ${lines.length} by comparing EXACT names/phones.`);
    if (foundCount === 0) {
        console.log("None of the names or phones matched. Here are the first 10 names in the database:");
        console.log(profiles.slice(0, 10).map(p => p.name));
    }
}

main();
