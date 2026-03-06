/**
 * Navigation Functions - navigation.js
 * Dynamic back button functionality
 */

/**
 * Smart back navigation - detects URL pattern and navigates to appropriate parent
 */
function goBack() {
    const currentUrl = window.location.href;
    console.log('Current URL:', currentUrl);
    
    try {
        // Parse the URL to extract components
        const url = new URL(currentUrl);
        const pathname = url.pathname;
        const origin = url.origin;
        
        console.log('Origin:', origin, 'Pathname:', pathname);
        
        // Pattern: /customers/username/project/page/sample/index.html
        // Target:  /customers/username/
        
        // Split path into segments
        const pathSegments = pathname.split('/').filter(segment => segment !== '');
        console.log('Path segments:', pathSegments);
        
        // Look for 'customers' segment
        const customersIndex = pathSegments.indexOf('customers');
        
        if (customersIndex !== -1 && pathSegments.length > customersIndex + 1) {
            // Build back URL: origin + /customers/username/
            const username = pathSegments[customersIndex + 1];
            const backUrl = `${origin}/customers/${username}/`;
            
            console.log('Navigating back to:', backUrl);
            
            // Show loading indicator
            showNavigationLoader();
            
            // Navigate to the back URL
            window.location.href = backUrl;
            
        } else {
            // Fallback: try browser back, or go to root
            console.log('Could not parse URL structure, using fallback');
            
            if (window.history.length > 1) {
                window.history.back();
            } else {
                // Last resort: go to root
                window.location.href = origin + '/';
            }
        }
        
    } catch (error) {
        console.error('Error in goBack function:', error);
        
        // Ultimate fallback
        if (window.history.length > 1) {
            window.history.back();
        } else {
            // Try to go to a reasonable parent directory
            const currentPath = window.location.pathname;
            const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
            if (parentPath !== currentPath) {
                window.location.href = window.location.origin + parentPath + '/';
            }
        }
    }
}

/**
 * Show loading indicator for navigation
 */
function showNavigationLoader() {
    // Create and show a simple loading overlay
    const loader = document.createElement('div');
    loader.id = 'navigationLoader';
    loader.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: Arial, sans-serif;
        color: white;
        font-size: 16px;
    `;
    
    loader.innerHTML = `
        <div style="text-align: center;">
            <div style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
            <div>Navigating back...</div>
        </div>
    `;
    
    // Add spin animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(loader);
    
    // Remove loader after 5 seconds (fallback)
    setTimeout(() => {
        const loaderElement = document.getElementById('navigationLoader');
        if (loaderElement) {
            loaderElement.remove();
        }
    }, 5000);
}

/**
 * Breadcrumb navigation helper (optional enhancement)
 */
function generateBreadcrumb() {
    const pathname = window.location.pathname;
    const segments = pathname.split('/').filter(segment => segment !== '');
    
    const breadcrumbs = [];
    let currentPath = '';
    
    segments.forEach((segment, index) => {
        currentPath += '/' + segment;
        
        // Skip file names and common segments
        if (!segment.includes('.') && segment !== 'page') {
            let displayName = segment;
            
            // Beautify common segments
            if (segment === 'customers') displayName = 'Customers';
            else if (segment.startsWith('Path')) displayName = 'Project: ' + segment;
            else if (segment.match(/^[A-Z]{2,}\d+$/)) displayName = 'Sample: ' + segment;
            
            breadcrumbs.push({
                name: displayName,
                path: window.location.origin + currentPath,
                isLast: index === segments.length - 1
            });
        }
    });
    
    return breadcrumbs;
}

/**
 * Test the back navigation (for debugging)
 */
function testBackNavigation() {
    console.log('=== Back Navigation Test ===');
    const breadcrumbs = generateBreadcrumb();
    console.log('Generated breadcrumbs:', breadcrumbs);
    
    // Simulate the back navigation without actually navigating
    const currentUrl = window.location.href;
    const url = new URL(currentUrl);
    const pathSegments = url.pathname.split('/').filter(segment => segment !== '');
    const customersIndex = pathSegments.indexOf('customers');
    
    if (customersIndex !== -1 && pathSegments.length > customersIndex + 1) {
        const username = pathSegments[customersIndex + 1];
        const backUrl = `${url.origin}/customers/${username}/`;
        console.log('Would navigate to:', backUrl);
        return backUrl;
    } else {
        console.log('Would use browser history back');
        return 'browser_back';
    }
}

// Export functions for global use
window.goBack = goBack;
window.testBackNavigation = testBackNavigation;