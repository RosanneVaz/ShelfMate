document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://localhost:3000/api';
    let token = localStorage.getItem('token');
     configureGoogleSignIn();
    // DOM Elements
    const authContainer = document.getElementById('auth-container');
    const appContent = document.getElementById('app-content');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const googleLoginBtn = document.getElementById('google-login');
    const googleRegisterBtn = document.getElementById('google-register');
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtn = document.getElementById('logout-btn');
    
    // Check if user is logged in
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            usernameDisplay.textContent = payload.username || payload.email || 'User';
            authContainer.style.display = 'none';
            appContent.style.display = 'block';
            
            initApp();
        } catch (e) {
            localStorage.removeItem('token');
        }
    }
    
    // Tab switching
    loginTab.addEventListener('click', () => {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.style.display = 'flex';
        registerForm.style.display = 'none';
    });
    
    registerTab.addEventListener('click', () => {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.style.display = 'flex';
        loginForm.style.display = 'none';
    });
    
    // Login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            if (!response.ok) throw new Error('Login failed');
            
            const { token: newToken, user } = await response.json();
            handleLoginSuccess(newToken, user);
        } catch (error) {
            alert(error.message);
        }
    });
    
    // Register form submission
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        
        try {
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            if (!response.ok) throw new Error('Registration failed');
            
            const { token: newToken, user } = await response.json();
            handleLoginSuccess(newToken, user);
        } catch (error) {
            alert(error.message);
        }
    });
    
    // Google Sign-In
    function configureGoogleSignIn() {
    const googleLoginBtn = document.getElementById('google-login');
    const googleRegisterBtn = document.getElementById('google-register');
    
    google.accounts.id.initialize({
        client_id: '355575999384-2gprtvtshpptmhhd5jvum28i71hs3fvf.apps.googleusercontent.com', // Replace with your actual client ID
        callback: handleGoogleResponse
    });
    
    // Render buttons
    google.accounts.id.renderButton(
        googleLoginBtn,
        { 
            type: 'standard',
            theme: 'filled_blue',
            size: 'large',
            text: 'signin_with',
            shape: 'pill'
        }
    );
    
    google.accounts.id.renderButton(
        googleRegisterBtn,
        { 
            type: 'standard',
            theme: 'filled_blue',
            size: 'large',
            text: 'signup_with',
            shape: 'pill'
        }
    );
    
    // Optional: Automatic prompt
    google.accounts.id.prompt();
}

async function handleGoogleResponse(response) {
    try {
        const authResponse = await fetch(`${API_URL}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: response.credential })
        });
        
        if (!authResponse.ok) {
            throw new Error('Google authentication failed');
        }
        
        const { token: newToken, user } = await authResponse.json();
        handleLoginSuccess(newToken, user);
    } catch (error) {
        console.error('Google Sign-In Error:', error);
        alert('Failed to sign in with Google. Please try again.');
    }
}
    
    // Logout
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        authContainer.style.display = 'flex';
        appContent.style.display = 'none';
    });
    
    function handleLoginSuccess(newToken, user) {
        localStorage.setItem('token', newToken);
        token = newToken;
        usernameDisplay.textContent = user.username || user.email || 'User';
        authContainer.style.display = 'none';
        appContent.style.display = 'block';
        
        // Clear forms
        loginForm.reset();
        registerForm.reset();
        
        initApp();
    }
    
    function initApp() {
        const bookForm = document.getElementById('book-form');
        const booksContainer = document.getElementById('books-container');
        const filterButtons = document.querySelectorAll('.filter-btn');
        
        bookForm.addEventListener('submit', addBook);
        filterButtons.forEach(btn => btn.addEventListener('click', filterBooks));
        fetchBooks();
        
        async function fetchBooks(filter = 'all') {
            try {
                let url = `${API_URL}/books`;
                if (filter !== 'all') {
                    url += `/${filter}`;
                }
                
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (!response.ok) {
                    if (response.status === 401) {
                        logout();
                        throw new Error('Session expired. Please login again.');
                    }
                    throw new Error('Failed to fetch books');
                }
                
                const books = await response.json();
                displayBooks(books);
            } catch (error) {
                console.error('Error fetching books:', error);
                booksContainer.innerHTML = `<p class="error">${error.message}</p>`;
            }
        }
        
        async function addBook(e) {
            e.preventDefault();
            
            const title = document.getElementById('title').value;
            const author = document.getElementById('author').value;
            const status = document.getElementById('status').value;
            
            const newBook = { title, author, status };
            
            try {
                const response = await fetch(`${API_URL}/books`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(newBook)
                });
                
                if (!response.ok) {
                    throw new Error('Failed to add book');
                }
                
                bookForm.reset();
                fetchBooks();
            } catch (error) {
                console.error('Error adding book:', error);
                alert(error.message);
            }
        }
        
        function displayBooks(books) {
            booksContainer.innerHTML = '';
            
            if (books.length === 0) {
                booksContainer.innerHTML = '<p>No books found. Add some books to get started!</p>';
                return;
            }
            
            books.forEach(book => {
                const bookCard = document.createElement('div');
                bookCard.className = 'book-card';
                bookCard.dataset.id = book._id;
                bookCard.dataset.status = book.status;
                
                const statusClass = `status-${book.status.replace(' ', '-')}`;
                const statusText = book.status.split('-').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ');
                
                bookCard.innerHTML = `
                    <div class="book-status ${statusClass}">${statusText}</div>
                    <h3>${book.title}</h3>
                    <p>by ${book.author}</p>
                    <div class="book-actions">
                        <button class="action-btn status-btn" onclick="updateStatus('${book._id}', '${book.status}')">
                            <i class="fas fa-sync-alt"></i> Update
                        </button>
                        <button class="action-btn delete-btn" onclick="deleteBook('${book._id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                `;
                
                booksContainer.appendChild(bookCard);
            });
        }
        
        function filterBooks() {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            const filter = this.dataset.filter;
            fetchBooks(filter);
        }
    }
});

// Global functions for inline event handlers
async function updateStatus(id, currentStatus) {
    const token = localStorage.getItem('token');
    let newStatus;
    
    if (currentStatus === 'to-read') {
        newStatus = 'reading';
    } else if (currentStatus === 'reading') {
        newStatus = 'read';
    } else {
        newStatus = 'to-read';
    }
    
    try {
        const response = await fetch(`http://localhost:3000/api/books/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update book');
        }
        
        document.querySelector('.filter-btn.active').click();
    } catch (error) {
        console.error('Error updating book status:', error);
        alert(error.message);
    }
}

async function deleteBook(id) {
    if (!confirm('Are you sure you want to delete this book?')) return;
    
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`http://localhost:3000/api/books/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete book');
        }
        
        document.querySelector('.filter-btn.active').click();
    } catch (error) {
        console.error('Error deleting book:', error);
        alert(error.message);
    }
}