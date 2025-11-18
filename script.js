// 이 파일은 메모 앱의 모든 동작을 처리하는 JavaScript 코드입니다.
// 사용자의 입력을 받고, 노트를 생성, 조회, 수정, 삭제(CRUD)하며,
// 웹 브라우저의 로컬 저장소(localStorage)를 사용해 데이터를 저장하고 불러옵니다.

// --- DOM 요소 가져오기 ---
const sidebarList = document.getElementById("sidebarList");
const newFolderBtn = document.getElementById("newFolderBtn");
const newBtn = document.getElementById("newBtn");
const deleteFolderBtn = document.getElementById("deleteFolderBtn");
const likeFilterBtn = document.getElementById("likeFilterBtn");
const darkModeToggle = document.getElementById("darkModeToggle");
const saveBtn = document.getElementById("saveBtn");
const deleteBtn = document.getElementById("deleteBtn");
const titleInput = document.getElementById("title");
const bodyTextarea = document.getElementById("body");
const searchInput = document.getElementById("search");
const autoSaveCheckbox = document.getElementById("autoSave");
const lastSavedSpan = document.getElementById("lastSaved");
const noteMetaSpan = document.getElementById("noteMeta");
const storageCountSpan = document.getElementById("storageCount");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFileInput = document.getElementById("importFile");
const fontFamilySelect = document.getElementById("fontFamily");
const fontSizeSelect = document.getElementById("fontSize");

// --- 상태 변수 ---
let notes = {};
let folders = {};
let settings = {};
const defaultSettings = { 
    fontFamily: 'Inter, sans-serif', 
    fontSize: '15px',
    isDarkMode: false,
};

let currentNoteId = null;
let activeFolderId = null;
let filterLiked = false;
let saveTimeout = null;
let draggedItem = null;

// --- SVG 아이콘 ---
const heartIconSVG = `<svg class="icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
const sunIconSVG = `<svg class="icon-svg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>`;
const moonIconSVG = `<svg class="icon-svg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>`;


// --- 초기화 ---
function initialize() {
  settings = JSON.parse(localStorage.getItem('notes-settings')) || { ...defaultSettings };
  notes = JSON.parse(localStorage.getItem("notes")) || {};
  folders = JSON.parse(localStorage.getItem("folders")) || {};

  migrateDataStructure();
  
  applySettings();
  applyTheme();
  renderSidebar();
  
  likeFilterBtn.innerHTML = heartIconSVG;

  titleInput.disabled = true;
  bodyTextarea.disabled = true;
  saveBtn.disabled = true;
  deleteBtn.disabled = true;
  deleteFolderBtn.disabled = true;

  console.log("앱이 초기화되었습니다.");
}

function migrateDataStructure() {
    let needsSave = false;
    Object.keys(folders).forEach(id => {
        if (folders[id].parentId === undefined) { folders[id].parentId = null; needsSave = true; }
        if (folders[id].isExpanded === undefined) { folders[id].isExpanded = true; needsSave = true; }
    });
    Object.keys(notes).forEach(id => {
        if (notes[id].folderId === undefined) { notes[id].folderId = null; needsSave = true; }
        if (notes[id].isLiked === undefined) { notes[id].isLiked = false; needsSave = true; }
    });
    if (needsSave) {
        console.log("데이터 구조를 마이그레이션했습니다.");
        saveData();
    }
}

// --- 렌더링 ---

function renderSidebar() {
    sidebarList.innerHTML = '';
    likeFilterBtn.classList.toggle('active', filterLiked);
    deleteFolderBtn.disabled = !activeFolderId || filterLiked;

    if (filterLiked) {
        renderLikedNotesList();
    } else {
        renderFolderHierarchy();
    }
    
    const totalNotes = Object.keys(notes).length;
    const likedNotesCount = Object.values(notes).filter(n => n.isLiked).length;
    storageCountSpan.textContent = filterLiked ? `${likedNotesCount} (좋아요)` : totalNotes;
}

function renderLikedNotesList() {
    const fragment = document.createDocumentFragment();
    const searchTerm = searchInput.value.toLowerCase();

    const likedNotes = Object.entries(notes)
        .filter(([_, note]) => note.isLiked)
        .sort(([, a], [, b]) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const header = document.createElement('div');
    header.className = 'folder-item';
    header.innerHTML = `<span class="folder-name">좋아요한 메모</span>`;
    header.style.color = 'var(--c-text-muted)';
    fragment.appendChild(header);

    likedNotes.forEach(([id, note]) => {
        if (!searchTerm || (note.title && note.title.toLowerCase().includes(searchTerm)) || (note.body && note.body.toLowerCase().includes(searchTerm))) {
            const noteItem = createNoteItem(note, id, 1);
            fragment.appendChild(noteItem);
        }
    });
    sidebarList.appendChild(fragment);
}

function renderFolderHierarchy() {
    const fragment = document.createDocumentFragment();
    renderChildren(null, 0, fragment);
    sidebarList.appendChild(fragment);
}

function renderChildren(parentId, level, fragment) {
    const searchTerm = searchInput.value.toLowerCase();

    const childFolders = Object.entries(folders)
        .filter(([_, folder]) => folder.parentId === parentId)
        .sort(([, a], [, b]) => a.name.localeCompare(b.name));

    childFolders.forEach(([id, folder]) => {
        const folderItem = createFolderItem(folder, id, level);
        fragment.appendChild(folderItem);
        if (folder.isExpanded) {
            renderChildren(id, level + 1, fragment);
        }
    });

    const childNotes = Object.entries(notes)
        .filter(([_, note]) => note.folderId === parentId)
        .sort(([, a], [, b]) => (b.updatedAt || 0) - (a.updatedAt || 0));

    childNotes.forEach(([id, note]) => {
        if (!searchTerm || (note.title && note.title.toLowerCase().includes(searchTerm)) || (note.body && note.body.toLowerCase().includes(searchTerm))) {
            const noteItem = createNoteItem(note, id, level);
            fragment.appendChild(noteItem);
        }
    });
}

function createFolderItem(folder, id, level) {
    const item = document.createElement('div');
    item.className = 'folder-item';
    if (!folder.isExpanded) item.classList.add('collapsed');
    if (id === activeFolderId && !filterLiked) item.classList.add('active');
    
    item.dataset.id = id;
    item.dataset.type = 'folder';
    item.style.paddingLeft = `${level * 20 + 10}px`;
    item.draggable = true;

    item.innerHTML = `<span class="folder-toggle"></span><span class="folder-name">${folder.name}</span>`;

    item.addEventListener('click', (e) => {
        if (e.target.classList.contains('folder-toggle')) toggleFolder(id);
        else setActiveFolder(id);
    });
    item.addEventListener("dragstart", handleDragStart);
    item.addEventListener("dragover", handleDragOver);
    item.addEventListener("drop", handleDrop);
    item.addEventListener("dragend", handleDragEnd);
    return item;
}

function createNoteItem(note, id, level) {
    const item = document.createElement("div");
    item.className = "note-item";
    if (id === currentNoteId) item.classList.add("active");
    
    item.dataset.id = id;
    item.dataset.type = 'note';
    item.style.paddingLeft = `${level * 20 + 20}px`;
    item.draggable = true;

    const likeBtn = document.createElement('button');
    likeBtn.className = 'like-btn';
    if (note.isLiked) likeBtn.classList.add('liked');
    likeBtn.innerHTML = heartIconSVG;
    likeBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleLike(id); });

    const titleDiv = document.createElement('div');
    titleDiv.className = 'note-title';
    titleDiv.textContent = note.title || "제목 없음";

    item.appendChild(likeBtn);
    item.appendChild(titleDiv);
    
    item.addEventListener("click", (e) => { e.stopPropagation(); openNote(id); });
    item.addEventListener("dragstart", handleDragStart);
    item.addEventListener("dragover", handleDragOver);
    item.addEventListener("drop", handleDrop);
    item.addEventListener("dragend", handleDragEnd);
    return item;
}

// --- 상태 변경 함수 ---

function toggleLike(noteId) {
    if (notes[noteId]) {
        notes[noteId].isLiked = !notes[noteId].isLiked;
        saveData();
        renderSidebar();
    }
}

function toggleLikeFilter() {
    filterLiked = !filterLiked;
    if (filterLiked) {
        activeFolderId = null;
        if (currentNoteId) {
            createNewNote();
        }
    }
    renderSidebar();
}

function setActiveFolder(folderId) {
    if (filterLiked) return;
    activeFolderId = (activeFolderId === folderId) ? null : folderId;
    renderSidebar();
}

function toggleFolder(folderId) {
    if (folders[folderId]) {
        folders[folderId].isExpanded = !folders[folderId].isExpanded;
        saveData();
        renderSidebar();
    }
}

function openNote(id) {
  if (saveTimeout) clearTimeout(saveTimeout);
  currentNoteId = id;
  if (!filterLiked) activeFolderId = notes[id].folderId;
  
  const note = notes[id];
  titleInput.value = note.title;
  bodyTextarea.value = note.body;
  noteMetaSpan.textContent = `생성: ${note.createdAt ? new Date(note.createdAt).toLocaleDateString() : ''}`;
  lastSavedSpan.textContent = `마지막 저장: ${note.updatedAt ? new Date(note.updatedAt).toLocaleString() : ''}`;

  titleInput.disabled = false;
  bodyTextarea.disabled = false;
  saveBtn.disabled = false;
  deleteBtn.disabled = false;

  renderSidebar();
  bodyTextarea.focus();
}

function createNewNote() {
  if (saveTimeout) clearTimeout(saveTimeout);
  currentNoteId = null;
  
  titleInput.value = "";
  bodyTextarea.value = "";
  noteMetaSpan.textContent = "새 노트";
  lastSavedSpan.textContent = "저장되지 않음";

  titleInput.disabled = false;
  bodyTextarea.disabled = false;
  saveBtn.disabled = false;
  deleteBtn.disabled = true;

  renderSidebar();
  titleInput.focus();
}

function saveCurrentNote() {
  const title = titleInput.value.trim();
  const body = bodyTextarea.value;

  if (currentNoteId && !title && !body) { deleteCurrentNote(); return; }
  if (!currentNoteId && !title && !body) return;

  const now = Date.now();
  if (!currentNoteId) {
    currentNoteId = `note_${now}`;
    notes[currentNoteId] = { 
        createdAt: now,
        folderId: filterLiked ? null : activeFolderId,
        isLiked: false,
    };
    deleteBtn.disabled = false;
  }
  
  notes[currentNoteId] = { ...notes[currentNoteId], title: title || "제목 없음", body: body, updatedAt: now };

  saveData();
  renderSidebar();
  lastSavedSpan.textContent = `마지막 저장: ${new Date(now).toLocaleString()}`;
}

function deleteCurrentNote() {
  if (!currentNoteId) return;
  if (confirm(`'${notes[currentNoteId].title}' 노트를 정말 삭제하시겠습니까?`)) {
    delete notes[currentNoteId];
    saveData();
    currentNoteId = null;
    createNewNote();
  }
}

function createNewFolder() {
    if (filterLiked) { alert("좋아요 필터 모드에서는 폴더를 생성할 수 없습니다."); return; }
    const folderName = prompt("새 폴더의 이름을 입력하세요:");
    if (folderName && folderName.trim()) {
        const newId = `folder_${Date.now()}`;
        folders[newId] = { name: folderName.trim(), createdAt: Date.now(), parentId: activeFolderId, isExpanded: true };
        saveData();
        renderSidebar();
    }
}

function deleteActiveFolder() {
    if (!activeFolderId || filterLiked) return;

    const folderName = folders[activeFolderId].name;
    if (!confirm(`'${folderName}' 폴더와 그 안의 모든 내용(하위 폴더 및 노트)을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
        return;
    }

    const itemsToDelete = collectItemsToDelete(activeFolderId);
    itemsToDelete.notes.forEach(noteId => delete notes[noteId]);
    itemsToDelete.folders.forEach(folderId => delete folders[folderId]);
    delete folders[activeFolderId];

    if (currentNoteId && itemsToDelete.notes.includes(currentNoteId)) {
        currentNoteId = null;
        createNewNote();
    }

    activeFolderId = null;
    saveData();
    renderSidebar();
}

function collectItemsToDelete(folderId, items = { notes: [], folders: [] }) {
    Object.keys(notes).forEach(noteId => {
        if (notes[noteId].folderId === folderId) items.notes.push(noteId);
    });
    Object.keys(folders).forEach(subFolderId => {
        if (folders[subFolderId].parentId === folderId) {
            items.folders.push(subFolderId);
            collectItemsToDelete(subFolderId, items);
        }
    });
    return items;
}

// --- 데이터 가져오기/내보내기 ---
function exportData() {
    const data = {
        notes: notes,
        folders: folders,
        settings: settings
    };
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memo-backup-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data && data.notes && data.folders && data.settings) {
                if (confirm('기존 데이터를 덮어쓰고 가져온 데이터로 복원하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
                    notes = data.notes;
                    folders = data.folders;
                    settings = data.settings;
                    
                    currentNoteId = null;
                    activeFolderId = null;

                    saveData();
                    applySettings();
                    applyTheme();
                    renderSidebar();
                    createNewNote(); // Reset editor view
                    alert('데이터를 성공적으로 불러왔습니다.');
                }
            } else {
                alert('파일 형식이 올바르지 않습니다.');
            }
        } catch (error) {
            alert('파일을 읽는 중 오류가 발생했습니다: ' + error.message);
        } finally {
            // Reset file input to allow re-uploading the same file
            event.target.value = null;
        }
    };
    reader.readAsText(file);
}

// --- 설정 및 테마 ---
function applyTheme() {
    if (settings.isDarkMode) {
        document.body.classList.add('dark');
        darkModeToggle.innerHTML = sunIconSVG;
    } else {
        document.body.classList.remove('dark');
        darkModeToggle.innerHTML = moonIconSVG;
    }
}

function toggleDarkMode() {
    settings.isDarkMode = !settings.isDarkMode;
    applyTheme();
    saveData();
}

function applySettings() {
    bodyTextarea.style.fontFamily = settings.fontFamily;
    bodyTextarea.style.fontSize = settings.fontSize;
    fontFamilySelect.value = settings.fontFamily;
    fontSizeSelect.value = settings.fontSize;
}

function updateSettings() {
    settings.fontFamily = fontFamilySelect.value;
    settings.fontSize = fontSizeSelect.value;
    saveData();
    applySettings();
}

// --- 데이터 관리 ---
function saveData() {
  localStorage.setItem("notes", JSON.stringify(notes));
  localStorage.setItem("folders", JSON.stringify(folders));
  localStorage.setItem("notes-settings", JSON.stringify(settings));
}

function handleAutoSave() {
    if (!autoSaveCheckbox.checked) return;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveCurrentNote();
    }, 1000);
}

// --- 드래그 앤 드롭 ---
function handleDragStart(e) {
    e.stopPropagation();
    draggedItem = { id: e.target.dataset.id, type: e.target.dataset.type };
    e.target.classList.add("dragging");
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) { e.preventDefault(); }

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const targetItem = e.target.closest('.folder-item, .note-item');
    if (!draggedItem || !targetItem || filterLiked) return;
    
    const draggedId = draggedItem.id;
    const targetId = targetItem.dataset.id;
    const targetType = targetItem.dataset.type;

    if (draggedId === targetId) return;

    if (draggedItem.type === 'note') {
        if (targetType === 'folder') {
            notes[draggedId].folderId = targetId;
        } else if (targetType === 'note') {
            notes[draggedId].folderId = notes[targetId].folderId;
        }
    } else if (draggedItem.type === 'folder') {
        if (targetType === 'folder') {
            let currentParentId = targetId;
            while (currentParentId) {
                if (currentParentId === draggedId) { alert("자기 자신 또는 하위 폴더로 이동할 수 없습니다."); return; }
                currentParentId = folders[currentParentId].parentId;
            }
            folders[draggedId].parentId = targetId;
        } else if (targetType === 'note') {
            folders[draggedId].parentId = notes[targetId].folderId;
        }
    }
    saveData();
    renderSidebar();
}

function handleDragEnd(e) {
    if (e.target.classList.contains('dragging')) e.target.classList.remove("dragging");
    draggedItem = null;
}

// --- 이벤트 리스너 설정 ---
newFolderBtn.addEventListener("click", createNewFolder);
newBtn.addEventListener("click", createNewNote);
deleteFolderBtn.addEventListener("click", deleteActiveFolder);
likeFilterBtn.addEventListener("click", toggleLikeFilter);
darkModeToggle.addEventListener("click", toggleDarkMode);
saveBtn.addEventListener("click", saveCurrentNote);
deleteBtn.addEventListener("click", deleteCurrentNote);
searchInput.addEventListener("input", renderSidebar);
titleInput.addEventListener("input", handleAutoSave);
bodyTextarea.addEventListener("input", handleAutoSave);
autoSaveCheckbox.addEventListener("change", () => { if (autoSaveCheckbox.checked) saveCurrentNote(); });
fontFamilySelect.addEventListener('change', updateSettings);
fontSizeSelect.addEventListener('change', updateSettings);
exportBtn.addEventListener('click', exportData);
importBtn.addEventListener('click', () => importFileInput.click());
importFileInput.addEventListener('change', handleImport);
document.addEventListener("keydown", (e) => { if (e.ctrlKey && e.key === "s") { e.preventDefault(); saveCurrentNote(); } });

// --- 앱 시작 ---
initialize();