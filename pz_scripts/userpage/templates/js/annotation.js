// Annotation
function showDeleteModal(name, onConfirm) {
    // Remove existing modal if one is already open
    const existing = document.getElementById('annotation-delete-modal');
    if (existing) existing.remove();

    // Build modal HTML
    const modalHTML = `
        <div class="annotation-delete-modal show" id="annotation-delete-modal">
            <div class="annotation-delete-modal-content">
                <div class="annotation-delete-modal-header">
                    <h3>Delete Annotation</h3>
                    <button class="annotation-delete-modal-close" onclick="document.getElementById('annotation-delete-modal').remove()">&times;</button>
                </div>
                <div class="annotation-delete-modal-body">
                    <p>Are you sure you want to delete <strong>${name}</strong>?</p>
                </div>
                <div class="annotation-delete-modal-actions">
                    <button class="annotation-delete-modal-confirm">Yes</button>
                    <button class="annotation-delete-modal-cancel">No</button>
                </div>
            </div>
        </div>
    `;

    // Add to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById('annotation-delete-modal');

    // Wire up buttons
    modal.querySelector('.annotation-delete-modal-cancel')
        .addEventListener('click', () => modal.remove());
    modal.querySelector('.annotation-delete-modal-close')
        .addEventListener('click', () => modal.remove());
    modal.querySelector('.annotation-delete-modal-confirm')
        .addEventListener('click', () => {
            if (typeof onConfirm === 'function') onConfirm();
            modal.remove();
        });
}
