// DOM Elements
const categoryList = document.querySelector('.category-list');
const entriesContainer = document.querySelector('.entries-container');
const searchInput = document.getElementById('search');
const entryModal = document.getElementById('entry-modal');
const entryForm = document.getElementById('entry-form');
const addEntryBtn = document.querySelector('.add-entry-btn');
const closeModalBtn = document.querySelector('.close-modal');
const cancelBtn = document.querySelector('.cancel-btn');
const portableIndicator = document.querySelector('.portable-mode-indicator span');

// State
let currentCategory = null;
let entries = [];
let config = null;
let currentEntryId = null;
let currentFilePath = null;
let currentFiles = [];
let pendingFiles = [];

// Initialize the app
async function initApp() {
    try {
        console.log('Starting app initialization...');
        
        // Load config
        console.log('Loading config...');
        config = await window.api.getConfig();
        updateDeviceInfo();
        console.log('Config loaded:', config);

        // Load categories
        console.log('Loading categories...');
        const categories = await window.api.getCategories();
        console.log('Categories loaded:', categories);
        
        if (!Array.isArray(categories)) {
            throw new Error('Invalid categories data received');
        }
        
        // Set up event listeners first
        setupEventListeners();
        
        // Initialize modal
        initializeModal();
        
        // Render categories
        renderCategories(categories);

        // Load entries for the first category if available
        if (categories && categories.length > 0) {
            console.log('Loading initial category:', categories[0]);
            currentCategory = categories[0].id;
            await loadEntries(currentCategory);
            
            // Update active state of first category
            const firstCategoryItem = document.querySelector('.category-item');
            if (firstCategoryItem) {
                firstCategoryItem.classList.add('active');
            }
        } else {
            console.log('No categories available');
            entriesContainer.innerHTML = `
                <div class="no-categories">
                    <p>No categories available. Please add a category first.</p>
                    <button class="add-category-btn">
                        <i class="fas fa-plus"></i>
                        Add Category
                    </button>
                </div>
            `;
            
            // Add click handler for the add category button
            const addCategoryBtn = entriesContainer.querySelector('.add-category-btn');
            if (addCategoryBtn) {
                addCategoryBtn.addEventListener('click', handleAddCategory);
            }
        }

        console.log('App initialization complete');
    } catch (error) {
        console.error('Error initializing app:', error);
        entriesContainer.innerHTML = `
            <div class="error-message">
                <p>Error initializing the application.</p>
                <button onclick="window.location.reload()">Refresh Page</button>
                <details>
                    <summary>Error Details (for debugging)</summary>
                    <pre>${error.message}</pre>
                </details>
            </div>
        `;
    }
}

// Initialize modal and its event listeners
function initializeModal() {
    // Ensure modal starts hidden
    entryModal.style.display = 'none';
    
    // Set up modal close handlers
    const closeModal = () => {
        entryModal.style.display = 'none';
        entryForm.reset();
    };
    
    // Add event listeners for modal controls
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    // Close modal when clicking outside
    entryModal.addEventListener('click', (e) => {
        if (e.target === entryModal) {
            closeModal();
        }
    });
    
    // Prevent modal close when clicking modal content
    entryModal.querySelector('.modal-content').addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// Update device info in UI
function updateDeviceInfo() {
    const deviceId = config.deviceId.slice(0, 8); // Show only first 8 characters
    portableIndicator.textContent = `Portable Mode (Device: ${deviceId})`;
}

// Check if merge notification should be shown
function checkMergeNotifications() {
    if (!config.settings.mergeNotifications) return;

    const lastMerged = config.lastMerged ? new Date(config.lastMerged) : null;
    if (!lastMerged || daysSince(lastMerged) >= config.settings.mergeNotificationDays) {
        showMergeNotification();
    }
}

// Calculate days since a date
function daysSince(date) {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Calculate time since a date
function timeSince(date) {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        return `${diffDays}d`;
    } else if (diffHours > 0) {
        return `${diffHours}h`;
    } else if (diffMinutes > 0) {
        return `${diffMinutes}m`;
    } else {
        return 'just now';
    }
}

// Show merge notification
function showMergeNotification() {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <i class="fas fa-sync-alt"></i>
        <span>It's been a while since your last merge. Consider exporting your changes to share with the team.</span>
        <button class="close-notification"><i class="fas fa-times"></i></button>
    `;
    document.body.appendChild(notification);

    // Handle close button
    notification.querySelector('.close-notification').addEventListener('click', () => {
        notification.remove();
    });
}

// Set up event listeners
function setupEventListeners() {
    // Search functionality
    searchInput.addEventListener('input', debounce(handleSearch, 300));

    // Add Entry button
    addEntryBtn.addEventListener('click', () => showModal());

    // Form submission
    entryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('title').value.trim();
        const categoryId = document.getElementById('category').value;
        if (!title || !categoryId) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        try {
            // Combine current and pending files
            const files = [...currentFiles, ...pendingFiles];
            
            const entry = {
                id: currentEntryId,
                title: title,
                description: document.getElementById('description').value,
                wisdom: document.getElementById('wisdom').value,
                categoryId: categoryId,
                files: files,
                tags: document.getElementById('tags').value
            };
            
            if (currentEntryId) {
                await window.api.updateEntry(entry);
            } else {
                await window.api.addEntry(entry);
            }
            
            // Close the modal first
            entryModal.style.display = 'none';
            
            // Reload entries for the current category
            if (currentCategory) {
                entries = await window.api.getEntries(currentCategory);
                renderEntries(entries);
            } else {
                // If no category is selected, set it to the one we just used
                currentCategory = categoryId;
                entries = await window.api.getEntries(categoryId);
                renderEntries(entries);
                
                // Update active state in category list
                document.querySelectorAll('.category-item').forEach(item => {
                    item.classList.remove('active');
                    if (item.dataset.id === categoryId) {
                        item.classList.add('active');
                    }
                });
            }
            
            // Refresh categories to update counts
            await refreshCategories();
            
            showNotification('Entry saved successfully', 'success');
        } catch (error) {
            console.error('Error saving entry:', error);
            showNotification(`Error saving entry: ${error.message}`, 'error');
        }
    });

    // Add category button
    document.querySelector('.add-category-btn').addEventListener('click', handleAddCategory);

    // Export/Import buttons
    document.querySelector('.export-btn').addEventListener('click', handleExport);
    document.querySelector('.import-btn').addEventListener('click', handleImport);
}

// Render categories in the sidebar
function renderCategories(categories) {
    categoryList.innerHTML = categories.map(category => `
        <div class="category-item ${category.id === currentCategory ? 'active' : ''}" data-id="${category.id}">
            <h3>${category.name}</h3>
            <span class="entry-count">${category.entryCount || 0} entries</span>
        </div>
    `).join('');

    // Add click event to categories
    document.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', () => {
            currentCategory = item.dataset.id;
            loadEntries(currentCategory);
            // Update active state
            document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

// Load entries for a category
async function loadEntries(categoryId) {
    try {
        console.log('Loading entries for category:', categoryId);
        if (!categoryId) {
            console.error('No category ID provided to loadEntries');
            entriesContainer.innerHTML = '<p>Error: No category selected. Please select a category.</p>';
            return;
        }
        
        // Show loading state
        entriesContainer.innerHTML = '<div class="loading">Loading entries...</div>';
        
        // Add debug logging
        console.log('Calling window.api.getEntries with categoryId:', categoryId);
        entries = await window.api.getEntries(categoryId);
        console.log('Entries loaded:', entries);
        
        if (!Array.isArray(entries)) {
            console.error('Received invalid entries data:', entries);
            throw new Error('Invalid entries data received');
        }
        
        renderEntries(entries);
    } catch (error) {
        console.error('Error loading entries:', error);
        entriesContainer.innerHTML = `
            <div class="error-message">
                <p>Error loading entries. Please try refreshing the page.</p>
                <button onclick="window.location.reload()">Refresh Page</button>
                <details>
                    <summary>Error Details (for debugging)</summary>
                    <pre>${error.message}</pre>
                </details>
            </div>
        `;
    }
}

// Helper function to render star ratings
function renderStars(entryId, currentRating = null) {
    let stars = '<div class="rating-stars" data-entry-id="' + entryId + '">';
    for (let i = 1; i <= 5; i++) {
        stars += `<span class="star ${i <= (currentRating || 0) ? 'active' : ''}" data-rating="${i}">★</span>`;
    }
    stars += '</div>';
    return stars;
}

// Handle star rating click
async function handleStarClick(star) {
    const entryId = star.parentElement.dataset.entryId;
    const rating = parseInt(star.dataset.rating);
    
    try {
        await window.api.addRating({
            entry_id: entryId,
            value: rating
        });
        
        // Update the stars visually
        const stars = star.parentElement.querySelectorAll('.star');
        stars.forEach((s, index) => {
            s.classList.toggle('active', index < rating);
        });
        
        showNotification('Rating saved successfully', 'success');
    } catch (error) {
        console.error('Error saving rating:', error);
        showNotification('Error saving rating', 'error');
    }
}

// Render entries in the main content area
function renderEntries(entriesToRender = entries) {
    console.log('Rendering entries:', entriesToRender);
    const container = document.querySelector('.entries-container');
    
    if (!entriesToRender || entriesToRender.length === 0) {
        container.innerHTML = `
            <div class="no-entries">
                <i class="fas fa-clipboard-list"></i>
                <p>No entries found in this category.</p>
                <button class="add-entry-btn">
                    <i class="fas fa-plus"></i>
                    Add Entry
                </button>
            </div>
        `;
        return;
    }
    
    // Clear the container
    container.innerHTML = '';
    
    // Create and append each entry element
    entriesToRender.forEach(entry => {
        console.log('Processing entry:', entry);
        console.log('Entry files:', entry.files);
        
        const entryElement = document.createElement('div');
        entryElement.className = 'entry';
        entryElement.dataset.entryId = entry.id;
        
        // Format dates
        const createdDate = new Date(entry.created_at);
        const lastEditDate = new Date(entry.last_edit_at || entry.updated_at);
        const timeSinceEdit = timeSince(lastEditDate);
        
        // Create the entry content
        entryElement.innerHTML = `
            <div class="entry-header">
                <div class="entry-title">
                    <h4>${entry.category_name || 'Entry'}</h4>
                    <h3>${entry.title}</h3>
                </div>
                <div class="entry-metadata">
                    <span class="metadata-item" title="Created on ${createdDate.toLocaleDateString()}">
                        <i class="fas fa-calendar-plus"></i>
                        ${createdDate.toLocaleDateString()}
                    </span>
                    <span class="metadata-item" title="Last edited ${lastEditDate.toLocaleString()}">
                        <i class="fas fa-clock"></i>
                        ${timeSinceEdit}
                    </span>
                    <span class="metadata-item" title="Viewed ${entry.view_count || 0} times">
                        <i class="fas fa-eye"></i>
                        ${entry.view_count || 0}
                    </span>
                </div>
            </div>
            <div class="entry-content">
                ${entry.description ? `
                    <div class="entry-section">
                        <h4><i class="fas fa-align-left"></i> Description</h4>
                        <p>${entry.description}</p>
                    </div>
                ` : ''}
                ${entry.wisdom ? `
                    <div class="entry-section">
                        <h4><i class="fas fa-lightbulb"></i> Wisdom</h4>
                        <p>${entry.wisdom}</p>
                    </div>
                ` : ''}
                ${(entry.files && entry.files.length > 0) || entry.file_path ? `
                    <div class="entry-section">
                        <h4><i class="fas fa-paperclip"></i> Files</h4>
                        <div class="files-list">
                            ${entry.files ? entry.files.map(file => `
                                <div class="file-attachment" title="Click to open file">
                                    <i class="fas fa-file"></i>
                                    <span class="file-name">${file.name || file.path.split('/').pop()}</span>
                                    <div class="file-actions">
                                        <button class="download-btn" title="Download file">
                                            <i class="fas fa-download"></i>
                                        </button>
                                    </div>
                                </div>
                            `).join('') : `
                                <div class="file-attachment" title="Click to open file">
                                    <i class="fas fa-file"></i>
                                    <span class="file-name">${entry.file_path.split('/').pop()}</span>
                                    <div class="file-actions">
                                        <button class="download-btn" title="Download file">
                                            <i class="fas fa-download"></i>
                                        </button>
                                    </div>
                                </div>
                            `}
                        </div>
                    </div>
                ` : ''}
            </div>
            <div class="entry-footer">
                <div class="rating-section">
                    ${renderStars(entry.id, 0)}
                </div>
                ${entry.tags ? `
                    <div class="tags">
                        ${entry.tags.split(',').map(tag => `<span class="tag" title="Filter by tag">${tag.trim()}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="entry-actions">
                    <button class="edit-btn" data-entry-id="${entry.id}" title="Edit entry">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                    <button class="delete-btn" data-entry-id="${entry.id}" title="Delete entry">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
        `;
        
        // Update the file click handlers to increment view count
        if ((entry.files && entry.files.length > 0) || entry.file_path) {
            const fileAttachments = entryElement.querySelectorAll('.file-attachment');
            fileAttachments.forEach((fileAttachment, index) => {
                const file = entry.files ? entry.files[index] : { path: entry.file_path };
                
                // Open file on click
                fileAttachment.addEventListener('click', async (e) => {
                    if (!e.target.closest('.download-btn')) {
                        try {
                            await window.api.openFile(file.path);
                            // Increment view count when file is opened
                            await window.api.incrementViewCount(entry.id);
                            // Update the view count display
                            const viewCountElement = entryElement.querySelector('.metadata-item[title^="Viewed"]');
                            if (viewCountElement) {
                                const currentCount = parseInt(viewCountElement.textContent) || 0;
                                viewCountElement.textContent = currentCount + 1;
                                viewCountElement.title = `Viewed ${currentCount + 1} times`;
                            }
                        } catch (error) {
                            console.error('Error opening file:', error);
                            showNotification('Failed to open file', 'error');
                        }
                    }
                });

                // Download file on download button click
                const downloadBtn = fileAttachment.querySelector('.download-btn');
                if (downloadBtn) {
                    downloadBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        try {
                            await window.api.downloadFile(file.path);
                            // Increment view count when file is downloaded
                            await window.api.incrementViewCount(entry.id);
                            // Update the view count display
                            const viewCountElement = entryElement.querySelector('.metadata-item[title^="Viewed"]');
                            if (viewCountElement) {
                                const currentCount = parseInt(viewCountElement.textContent) || 0;
                                viewCountElement.textContent = currentCount + 1;
                                viewCountElement.title = `Viewed ${currentCount + 1} times`;
                            }
                            showNotification('File download started', 'success');
                        } catch (error) {
                            console.error('Error downloading file:', error);
                            showNotification('Failed to download file', 'error');
                        }
                    });
                }
            });
        }
        
        // Update the rating stars display in renderEntries
        const ratingSection = entryElement.querySelector('.rating-section');
        if (ratingSection) {
            window.api.getUserRating(entry.id).then(userRating => {
                ratingSection.innerHTML = renderStars(entry.id, userRating);
                
                // Add click handlers to the stars
                const stars = ratingSection.querySelectorAll('.star');
                stars.forEach(star => {
                    star.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const rating = parseInt(star.dataset.rating);
                        try {
                            await window.api.addRating({
                                entry_id: entry.id,
                                value: rating
                            });
                            
                            // Update the stars visually
                            stars.forEach((s, index) => {
                                s.classList.toggle('active', index < rating);
                            });
                            
                            showNotification('Rating saved successfully', 'success');
                        } catch (error) {
                            console.error('Error saving rating:', error);
                            showNotification('Error saving rating', 'error');
                        }
                    });
                });
            });
        }
        
        // Add edit button handler
        const editBtn = entryElement.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showModal(entry);
            });
        }
        
        // Add delete button handler
        const deleteBtn = entryElement.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this entry? This action cannot be undone.')) {
                    try {
                        await window.api.deleteEntry(entry.id);
                        // Reload entries after deletion
                        entries = await window.api.getEntries(currentCategory);
                        renderEntries(entries);
                        // Refresh categories to update counts
                        await refreshCategories();
                        showNotification('Entry deleted successfully', 'success');
                    } catch (error) {
                        console.error('Error deleting entry:', error);
                        showNotification('Failed to delete entry', 'error');
                    }
                }
            });
        }
        
        // Add the complete entry to the container
        container.appendChild(entryElement);
    });
}

// Handle search
async function handleSearch(event) {
    const query = event.target.value.toLowerCase();
    const filteredEntries = entries.filter(entry => 
        entry.title.toLowerCase().includes(query) ||
        entry.description.toLowerCase().includes(query) ||
        entry.wisdom.toLowerCase().includes(query) ||
        (entry.tags && entry.tags.some(tag => tag.toLowerCase().includes(query)))
    );
    renderEntries(filteredEntries);
}

// Populate category dropdown
async function populateCategoryDropdown() {
    try {
        const categorySelect = document.getElementById('category');
        const categories = await window.api.getCategories();
        
        // Clear existing options
        categorySelect.innerHTML = '';
        
        // Add a placeholder option
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '-- Select a Category --';
        placeholder.disabled = true;
        placeholder.selected = true;
        categorySelect.appendChild(placeholder);
        
        // Sort categories by name
        const sortedCategories = categories.sort((a, b) => a.name.localeCompare(b.name));
        
        // Add unique categories to dropdown
        const addedNames = new Set();
        sortedCategories.forEach(category => {
            if (!addedNames.has(category.name)) {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                categorySelect.appendChild(option);
                addedNames.add(category.name);
            }
        });
        
        // Set the current category as selected if available
        if (currentCategory) {
            categorySelect.value = currentCategory;
        }
    } catch (error) {
        console.error('Error populating category dropdown:', error);
    }
}

// Show modal for adding/editing entries
function showModal(entry = null) {
    console.log('Opening modal with entry:', entry);
    
    // Reset form and clear any existing data
    entryForm.reset();
    pendingFiles = [];
    
    // Update modal title
    const modalTitle = entryModal.querySelector('h2');
    modalTitle.textContent = entry ? 'Edit Entry' : 'Add New Entry';
    
    // Remove any existing file info
    const existingFileInfo = entryModal.querySelector('.current-file-info');
    if (existingFileInfo) {
        existingFileInfo.remove();
    }

    // Initialize form fields
    const formFields = entryForm.querySelectorAll('input, textarea, select');
    formFields.forEach(field => {
        field.disabled = false;
        field.readOnly = false;
        field.style.pointerEvents = 'auto';
        field.style.userSelect = 'auto';
        field.style.opacity = '1';
        field.style.backgroundColor = 'white';
        field.style.cursor = field.type === 'file' || field.tagName === 'SELECT' ? 'pointer' : 'text';
        field.style.position = 'relative';
        field.style.zIndex = '1';
    });
    
    // Show modal
    entryModal.style.display = 'block';
    
    // Populate category dropdown and then set form values
    populateCategoryDropdown().then(() => {
        if (entry) {
            // If editing an existing entry
            currentEntryId = entry.id;
            currentFiles = entry.files || [];
            document.getElementById('title').value = entry.title || '';
            document.getElementById('description').value = entry.description || '';
            document.getElementById('wisdom').value = entry.wisdom || '';
            document.getElementById('tags').value = entry.tags || '';
            
            // Set the category
            const categorySelect = document.getElementById('category');
            if (entry.category_id) {
                categorySelect.value = entry.category_id;
            } else if (entry.categoryId) {
                categorySelect.value = entry.categoryId;
            }
        } else {
            // If adding a new entry
            currentEntryId = null;
            currentFiles = [];
            
            // Set the current category if one is selected
            if (currentCategory) {
                const categorySelect = document.getElementById('category');
                categorySelect.value = currentCategory;
            }
        }
        
        // Update file display
        updateFileDisplay();
        
        // Focus on title field
        document.getElementById('title').focus();
    });
}

// Handle file input changes
document.getElementById('file').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    
    for (const file of files) {
        try {
            // Save the file and get the new path
            const result = await window.api.saveFile({
                name: file.name,
                path: file.path || file.name
            });
            
            pendingFiles.push({
                name: file.name,
                path: result.filePath
            });
            
            // Update the file display
            updateFileDisplay();
        } catch (error) {
            console.error('Error saving file:', error);
            showNotification('Error saving file', 'error');
        }
    }
    
    // Clear the file input
    e.target.value = '';
});

// Update the file display in the modal
function updateFileDisplay() {
    const fileInfo = document.createElement('div');
    fileInfo.className = 'current-file-info';
    
    const allFiles = [...currentFiles, ...pendingFiles];
    
    if (allFiles.length > 0) {
        fileInfo.innerHTML = `
            <p>Attached files:</p>
            <ul class="file-list">
                ${allFiles.map(file => `
                    <li>
                        <span>${file.name || file.path.split('/').pop()}</span>
                        <button type="button" class="remove-file-btn" data-path="${file.path}">
                            <i class="fas fa-times"></i>
                        </button>
                    </li>
                `).join('')}
            </ul>
        `;
        
        // Add event listeners for remove file buttons
        fileInfo.querySelectorAll('.remove-file-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const path = btn.dataset.path;
                // Remove from either currentFiles or pendingFiles
                currentFiles = currentFiles.filter(file => file.path !== path);
                pendingFiles = pendingFiles.filter(file => file.path !== path);
                updateFileDisplay();
            });
        });
    } else {
        fileInfo.innerHTML = '<p>No files attached</p>';
    }
    
    // Remove existing file info if present
    const existingFileInfo = entryModal.querySelector('.current-file-info');
    if (existingFileInfo) {
        existingFileInfo.remove();
    }
    
    // Insert new file info before form actions
    const formActions = entryModal.querySelector('.form-actions');
    entryModal.querySelector('form').insertBefore(fileInfo, formActions);
}

// Handle add category
async function handleAddCategory() {
    const name = prompt('Enter category name:');
    if (name) {
        try {
            await window.api.addCategory(name);
            const categories = await window.api.getCategories();
            renderCategories(categories);
        } catch (error) {
            console.error('Error adding category:', error);
        }
    }
}

// Handle export
async function handleExport() {
    try {
        await window.api.exportData({
            format: 'zip',
            includeFiles: true
        });
        
        // Update last merged date
        config.lastMerged = new Date().toISOString();
        await window.api.updateConfig(config);
        
        alert('Export completed successfully!');
    } catch (error) {
        console.error('Error exporting data:', error);
    }
}

// Handle import
async function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    
    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (file) {
            try {
                await window.api.importData(file);
                
                // Update last merged date
                config.lastMerged = new Date().toISOString();
                await window.api.updateConfig(config);
                
                alert('Import completed successfully!');
                // Refresh the view
                const categories = await window.api.getCategories();
                renderCategories(categories);
                if (currentCategory) {
                    loadEntries(currentCategory);
                }
            } catch (error) {
                console.error('Error importing data:', error);
            }
        }
    };
    
    input.click();
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Add getCategoryName function
async function getCategoryName(categoryId) {
    try {
        const categories = await window.api.getCategories();
        const category = categories.find(cat => cat.id === categoryId);
        return category ? category.name : 'Unknown Category';
    } catch (error) {
        console.error('Error getting category name:', error);
        return 'Unknown Category';
    }
}

// Add showNotification function if it doesn't exist
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
        <span>${message}</span>
        <button class="close-notification"><i class="fas fa-times"></i></button>
    `;
    document.body.appendChild(notification);

    // Add close button handler
    const closeBtn = notification.querySelector('.close-notification');
    closeBtn.addEventListener('click', () => notification.remove());

    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Add a function to refresh categories
async function refreshCategories() {
    try {
        const categories = await window.api.getCategories();
        renderCategories(categories);
    } catch (error) {
        console.error('Error refreshing categories:', error);
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp); 