// script.js - Complaint form logic (Aadhar verify, file list, submit, speech-to-text)

// --- Defensive: wait for DOM ---
document.addEventListener('DOMContentLoaded', () => {

  // elements
  const verifyBtn = document.getElementById('verifyBtn');
  const aadharInput = document.getElementById('aadharNumber');
  const verificationStatus = document.getElementById('verificationStatus');
  const formContainer = document.getElementById('complaintFormContainer');
  const complaintForm = document.getElementById('complaintForm');
  const fileInput = document.getElementById('evidence');
  const fileList = document.getElementById('fileList');
  const dropArea = document.getElementById('dropArea');
  const submitBtn = document.getElementById('submitBtn');
  const descField = document.getElementById('description');
  const micBtn = document.getElementById("micButton");

  // --- Aadhar Verification ---
  function setVerifiedUI(isVerified) {
    if (isVerified) {
      verificationStatus.innerHTML = '<span style="color:#4CAF50;">✅ Verified</span>';
      formContainer.style.opacity = '1';
      formContainer.style.pointerEvents = 'auto';
    } else {
      verificationStatus.innerHTML = '<span style="color:#f44336;">❌ Invalid Aadhar</span>';
      formContainer.style.opacity = '0.5';
      formContainer.style.pointerEvents = 'none';
    }
  }

  verifyBtn && verifyBtn.addEventListener('click', () => {
    const a = aadharInput.value.trim();
    if (/^\d{12}$/.test(a)) {
      setVerifiedUI(true);
    } else {
      setVerifiedUI(false);
      alert('Please enter a valid 12-digit Aadhaar number.');
    }
  });

  // --- File Upload + Drag Drop ---
  function updateFileList(files) {
    fileList.innerHTML = '';
    Array.from(files).forEach(file => {
      const div = document.createElement('div');
      div.textContent = `${file.name} (${Math.round(file.size/1024)} KB)`;
      fileList.appendChild(div);
    });
  }

  dropArea && dropArea.addEventListener('click', () => {
    fileInput.click();
  });

  if (dropArea) {
    ['dragenter','dragover'].forEach(ev => {
      dropArea.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropArea.classList.add('dragover');
      });
    });
    ['dragleave','drop'].forEach(ev => {
      dropArea.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropArea.classList.remove('dragover');
      });
    });
    dropArea.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) {
        fileInput.files = dt.files;
        updateFileList(dt.files);
      }
    });
  }

  fileInput && fileInput.addEventListener('change', () => {
    updateFileList(fileInput.files);
  });

  // --- Form Submit ---
  complaintForm && complaintForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      aadharNumber: (document.getElementById('aadharNumber')||{}).value?.trim() || '',
      complaintType: (document.getElementById('complaintType')||{}).value || '',
      priority: (document.getElementById('priority')||{}).value || '',
      incidentDate: (document.getElementById('incidentDate')||{}).value || '',
      location: (document.getElementById('location')||{}).value?.trim() || '',
      description: (document.getElementById('description')||{}).value?.trim() || '',
      fullName: (document.getElementById('fullName')||{}).value?.trim() || '',
      phone: (document.getElementById('phone')||{}).value?.trim() || '',
      email: (document.getElementById('email')||{}).value?.trim() || '',
      address: (document.getElementById('address')||{}).value?.trim() || '',
      witnesses: (document.getElementById('witnesses')||{}).value?.trim() || '',
      anonymous: !!(document.getElementById('anonymous')||{}).checked,
      smsUpdates: !!(document.getElementById('smsUpdates')||{}).checked,
      emailUpdates: !!(document.getElementById('emailUpdates')||{}).checked,
      evidenceFiles: Array.from((fileInput && fileInput.files) || []).map(f => f.name)
    };

    // Validate Aadhaar
    if (!/^\d{12}$/.test(payload.aadharNumber)) {
      alert('⚠️ Please enter a valid 12-digit Aadhaar number.');
      aadharInput.focus();
      return;
    }

    // Validate phone
    if (payload.phone && !/^\d{10}$/.test(payload.phone)) {
      alert('⚠️ Please enter a valid 10-digit phone number.');
      document.getElementById('phone').focus();
      return;
    }

    // Required fields
    if (!payload.fullName || !payload.complaintType || !payload.location || !payload.description) {
      alert('⚠️ Please fill the required fields: name, complaint type, location and description.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
      const res = await fetch('http://localhost:5000/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        alert(`✅ Complaint submitted successfully!\n\n📌 Your Case ID: ${data.caseId}\n\nUse this ID to track your case.`);
        complaintForm.reset();
        updateFileList([]);
        formContainer.style.opacity = '0.5';
        formContainer.style.pointerEvents = 'none';
        verificationStatus.innerHTML = '<span style="color: #FFC107;">⏳ Verification Pending</span>';
      } else {
        alert('❌ Error submitting complaint: ' + (data.message || data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert('❌ Failed to connect to server. Ensure backend is running and accessible at http://localhost:5000');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '🚀 Submit Complaint';
    }
  });

  // --- Page Navigation helper ---
  window.showPage = function(page) {
    document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
    const el = document.getElementById(page + '-page');
    if (el) el.classList.add('active');
    document.querySelectorAll('.page-nav-btn').forEach(btn => btn.classList.remove('active'));
  };

  window.verifyAadhar = function() {
    const a = (aadharInput && aadharInput.value || '').trim();
    if (/^\d{12}$/.test(a)) {
      setVerifiedUI(true);
    } else {
      setVerifiedUI(false);
      alert('Please enter a valid 12-digit Aadhaar number.');
    }
  };

  // --- Speech to Text (for description field) ---
  let recognition;
  let isListening = false;

  if ("webkitSpeechRecognition" in window && micBtn) {
    recognition = new webkitSpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      isListening = true;
      micBtn.textContent = "🎤 Listening... (click to stop)";
      micBtn.style.backgroundColor = "red";
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      descField.value = (descField.value + " " + transcript).trim();
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      stopListening();
    };

    recognition.onend = () => {
      isListening = false;
      micBtn.textContent = "🎤 Start Voice Input";
      micBtn.style.backgroundColor = "";
    };
  }

  function startListening() {
    if (recognition && !isListening) recognition.start();
  }

  function stopListening() {
    if (recognition && isListening) recognition.stop();
  }

  micBtn && micBtn.addEventListener("click", () => {
    if (!recognition) {
      alert("Speech recognition not supported in this browser.");
      return;
    }
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  });

}); 
// --- inside DOMContentLoaded
const descriptionInput = document.getElementById('description');
const prioritySelect = document.getElementById('priority');

// AI-like severity estimator
function estimateSeverity(text) {
  text = text.toLowerCase();

  if (/(murder|life threat|terror|kidnap|hostage|emergency|urgent|rape|kill|killing)/.test(text)) {
    return "urgent";
  }
  if (/(attack|assault|violence|harassment|theft|robbery|beating|national-security)/.test(text)) {
    return "high";
  }
  if (/(fraud|cheating|scam|cyber|stalking|extortion)/.test(text)) {
    return "medium";
  }
  return "low"; // default
}


// Hook into description field
descriptionInput && descriptionInput.addEventListener('blur', () => {
  const text = descriptionInput.value.trim();
  if (!text) return;

  const severity = estimateSeverity(text);

  // update dropdown
  prioritySelect.value = severity;

  // show user feedback
  alert(`🤖 AI Suggestion: Based on your description, the complaint priority is set to "${severity.toUpperCase()}"`);
});

