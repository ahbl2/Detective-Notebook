window.apiService = {
    async getSections() {
        const res = await fetch('/api/sections', {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            }
        });
        if (!res.ok) throw new Error('Failed to fetch sections');
        return res.json();
    }
    // Add other methods as needed
}; 