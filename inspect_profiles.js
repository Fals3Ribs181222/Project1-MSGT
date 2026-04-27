const SUPABASE_URL = 'https://tksruuqtzxflgglnljef.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrc3J1dXF0enhmbGdnbG5samVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzY0OTIsImV4cCI6MjA4Nzk1MjQ5Mn0.eu6LwoP-9O5sG9nHhBza0UgYHCOm7Ni5flk_1Lgl4FU';

async function main() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?limit=5`, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
    });
    
    if (!res.ok) {
        console.error("Failed to fetch from supabase", await res.text());
        return;
    }
    const profiles = await res.json();
    console.log(JSON.stringify(profiles, null, 2));

    const resCount = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id`, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
    });
    const profilesCount = await resCount.json();
    console.log(`Total profiles: ${profilesCount.length}`);
}

main();
