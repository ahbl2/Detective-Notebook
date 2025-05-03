// Section management
async function getSections() {
    try {
        const response = await fetch('/api/sections', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch sections');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching sections:', error);
        throw error;
    }
}

async function setCurrentSection(sectionId) {
    try {
        const response = await fetch('/api/sections/current', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ sectionId })
        });
        if (!response.ok) {
            throw new Error('Failed to set current section');
        }
        return await response.json();
    } catch (error) {
        console.error('Error setting current section:', error);
        throw error;
    }
}

async function toggleGuideDropdown(isOpen) {
    try {
        const response = await fetch('/api/sections/guide-dropdown', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ isOpen })
        });
        if (!response.ok) {
            throw new Error('Failed to toggle guide dropdown');
        }
        return await response.json();
    } catch (error) {
        console.error('Error toggling guide dropdown:', error);
        throw error;
    }
}

// Add to the exported apiService object
const apiService = {
    getSections,
    setCurrentSection,
    toggleGuideDropdown
};

export default apiService; 