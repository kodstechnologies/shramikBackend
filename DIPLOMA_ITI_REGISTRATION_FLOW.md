# Diploma & ITI Holder Registration Flow - Current Status

## 📋 Overview

The registration for **Diploma Holder** and **ITI Holder** is a **multi-step process** (3 steps) that requires:
1. Mobile OTP verification
2. Step 1: Upload Aadhaar Card & Profile Photo
3. Step 2: Select Trade/Specialization, Skills, and Answer Questions
4. Step 3: Education Details, Experience Status, and Document Uploads

---

## ✅ What's Already Implemented

### **1. OTP Verification (Common for All Categories)**
- ✅ **POST** `/api/job-seekers/send-otp`
  - Accepts: `phone`, `category` (optional)
  - Generates 4-digit OTP (currently hardcoded to "1234" in dev)
  - Returns: `otp` (dev only), `isExistingUser` boolean
  - **Status**: ✅ Complete

- ✅ **POST** `/api/job-seekers/verify-otp`
  - Accepts: `phone`, `otp`, `category` (required for new users)
  - Verifies OTP and creates/updates JobSeeker record
  - Sets `phoneVerified: true`, `registrationStep: 1`
  - **Status**: ✅ Complete

---

### **2. Step 1: Upload Documents**
- ✅ **POST** `/api/job-seekers/register/step1`
  - **Accepts**:
    - `phone` (required)
    - Files: `aadhaarCard`, `profilePhoto` (multipart/form-data)
  - **Validations**:
    - ✅ Phone must be verified
    - ✅ Category must be "Diploma Holder" or "ITI Holder"
    - ✅ Aadhaar card file required
    - ✅ Profile photo file required
  - **Updates**:
    - ✅ Saves file paths to `aadhaarCard` and `profilePhoto`
    - ✅ Sets `registrationStep: 2`
  - **Status**: ✅ Complete

---

### **3. Step 2: Select Trade, Skills & Answer Questions**
- ✅ **POST** `/api/job-seekers/register/step2`
  - **Accepts** (JSON body):
    - `phone` (required)
    - `specializationId` (required) - Trade/Specialization ID
    - `selectedSkills` (required) - Array of skill names
    - `questionAnswers` (required) - Array of question answers
      ```json
      [
        {
          "questionId": "string",
          "questionText": "string",
          "selectedOption": "string",
          "isCorrect": "boolean (optional)"
        }
      ]
      ```
    - `role` (optional) - "WOrker", "Contractor", "Admin" (default: "Worker")
  - **Validations**:
    - ✅ Phone must be verified
    - ✅ `registrationStep >= 2` (must complete Step 1 first)
    - ✅ Specialization must exist
    - ✅ All selected skills must belong to the specialization
    - ✅ Question set must exist for specialization
    - ✅ All questions must be answered
  - **Processing**:
    - ✅ Validates skills against specialization
    - ✅ Fetches question set for specialization
    - ✅ Auto-calculates `isCorrect` for each answer
    - ✅ Stores `specializationId`, `selectedSkills`, `questionAnswers`, `role`
  - **Updates**:
    - ✅ Sets `registrationStep: 3`
  - **Status**: ✅ Complete

---

### **4. Step 3: Education & Experience Details**
- ✅ **POST** `/api/job-seekers/register/step3`
  - **Accepts** (multipart/form-data):
    - `phone` (required)
    - `education` (required, JSON string):
      ```json
      {
        "collegeInstituteName": "string",
        "city": "string",
        "state": "string",
        "yearOfPassing": "string",
        "percentageOrGrade": "string"
      }
      ```
    - `experienceStatus` (required, JSON string):
      ```json
      {
        "hasExperience": "boolean",
        "isFresher": "boolean"
      }
      ```
    - Files:
      - `resume` (required)
      - `experienceCertificate` (required if `hasExperience: true`)
      - `documents` (optional, max 5 files)
  - **Validations**:
    - ✅ Phone must be verified
    - ✅ `registrationStep >= 3` (must complete Step 2 first)
    - ✅ Resume file required
    - ✅ Experience certificate required if `hasExperience: true`
  - **Updates**:
    - ✅ Saves `education` object
    - ✅ Saves `experienceStatus` object
    - ✅ Saves file paths: `resume`, `experienceCertificate`, `documents[]`
    - ✅ Sets `registrationStep: 4`
    - ✅ Sets `isRegistrationComplete: true`
    - ✅ Sets `status: "Pending"`
  - **Status**: ✅ Complete

---

### **5. Supporting APIs**
- ✅ **GET** `/api/job-seekers/categories` - Get all active categories
- ✅ **GET** `/api/job-seekers/specializations` - Get all active specializations
- ✅ **GET** `/api/job-seekers/specialization/:specializationId` - Get specialization with skills and questions
- ✅ **GET** `/api/job-seekers/skills-by-category?category=Diploma Holder` - Get skills for a category
- ✅ **GET** `/api/job-seekers/phone/:phone` - Get job seeker by phone

---

## 📊 Data Model Structure

### **JobSeeker Schema** (Current)
```javascript
{
  // Basic Info
  phone: String (unique, required)
  phoneVerified: Boolean (default: false)
  category: "Non-Degree Holder" | "Diploma Holder" | "ITI Holder"
  role: "Worker" | "Contractor" | "Admin" (default: "Worker")
  
  // Location
  state: String
  city: String
  
  // Skills & Specialization
  specializationId: ObjectId (ref: Specialization)
  skills: [String] // All skills from specialization
  selectedSkills: [String] // User's selected skills
  
  // Questions (Diploma/ITI only)
  questionAnswers: [{
    questionId: String
    questionText: String
    selectedOption: String
    isCorrect: Boolean
  }]
  
  // Documents
  aadhaarCard: String (file path)
  profilePhoto: String (file path)
  resume: String (file path)
  experienceCertificate: String (file path, conditional)
  documents: [String] (array of file paths)
  
  // Education (Diploma/ITI only)
  education: {
    collegeInstituteName: String
    city: String
    state: String
    yearOfPassing: String
    percentageOrGrade: String
  }
  
  // Experience
  experienceStatus: {
    hasExperience: Boolean (default: false)
    isFresher: Boolean (default: true)
  }
  
  // Registration Status
  registrationStep: Number (0-4)
  isRegistrationComplete: Boolean (default: false)
  status: "Pending" | "Active" | "Inactive" | "Rejected" (default: "Pending")
}
```

---

## 🔄 Registration Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User Chooses Category: "Diploma Holder" or "ITI Holder" │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. POST /send-otp                                           │
│    Body: { phone, category }                                │
│    Response: { otp: "1234", isExistingUser: false }        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. POST /verify-otp                                         │
│    Body: { phone, otp, category }                           │
│    Creates JobSeeker: { phone, category, registrationStep: 1 } │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. STEP 1: POST /register/step1                            │
│    Form-Data: phone, aadhaarCard (file), profilePhoto (file)│
│    Updates: aadhaarCard, profilePhoto, registrationStep: 2  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. STEP 2: POST /register/step2                            │
│    Body: { phone, specializationId, selectedSkills[],       │
│            questionAnswers[], role }                        │
│    Updates: specializationId, selectedSkills, questionAnswers│
│             role, registrationStep: 3                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. STEP 3: POST /register/step3                            │
│    Form-Data: phone, education (JSON), experienceStatus    │
│              (JSON), resume (file), experienceCertificate   │
│              (file, conditional), documents[] (files)       │
│    Updates: education, experienceStatus, resume,             │
│             experienceCertificate, documents,               │
│             registrationStep: 4, isRegistrationComplete: true│
└─────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Potential Issues / Missing Features

### **1. Validation Issues**
- ✅ **Step 1**: `category` removed from validation schema (already set in verify-otp)

### **2. Missing Validations**
- ⚠️ **Step 2**: No validation that `questionAnswers` array length matches question set length (controller checks, but not in Joi)
  - **Status**: Controller validates, but could be better in Joi

### **3. Error Handling**
- ✅ Good error messages for missing files
- ✅ Good validation for step progression
- ⚠️ Could add more specific error messages for invalid question answers

### **4. File Upload**
- ✅ Multer configured correctly
- ✅ File paths stored correctly
- ✅ Static file serving configured
- ⚠️ No file size limits set
- ⚠️ No file type validation (only checks if file exists)

### **5. Data Consistency**
- ⚠️ `skills` and `selectedSkills` both stored (redundant?)
  - In Step 2, both are set: `jobSeeker.skills = selectedSkills` and `jobSeeker.selectedSkills = selectedSkills`
  - **Question**: Should we keep both or just `selectedSkills`?

### **6. Missing Features**
- ⚠️ No API to get current registration progress (which step user is on)
- ⚠️ No API to resume registration from a specific step
- ⚠️ No validation that user can't skip steps

---

## 🎯 Next Steps / Improvements Needed

### **High Priority**
1. ✅ Fix `step1RegistrationSchema` - Remove `category` requirement (already set in verify-otp)
2. ✅ Add file size limits in Multer configuration
3. ✅ Add file type validation (images for aadhaarCard/profilePhoto, PDF for resume)
4. ✅ Add API to get registration progress: `GET /api/job-seekers/registration-status/:phone`

### **Medium Priority**
1. ✅ Clean up redundant `skills` field (keep only `selectedSkills`)
2. ✅ Add better error messages for question validation
3. ✅ Add validation to prevent step skipping

### **Low Priority**
1. ✅ Add API to resume registration from a specific step
2. ✅ Add validation for education year format
3. ✅ Add validation for percentage/grade format

---

## 📝 Testing Checklist

### **Step 1 Testing**
- [ ] Send OTP with valid phone
- [ ] Verify OTP with correct code
- [ ] Upload Step 1 with valid files
- [ ] Test with missing aadhaarCard file
- [ ] Test with missing profilePhoto file
- [ ] Test with unverified phone

### **Step 2 Testing**
- [ ] Complete Step 2 with valid specialization
- [ ] Test with invalid specialization ID
- [ ] Test with skills not belonging to specialization
- [ ] Test with missing question answers
- [ ] Test with incomplete question answers
- [ ] Test without completing Step 1 first

### **Step 3 Testing**
- [ ] Complete Step 3 with fresher (no experience)
- [ ] Complete Step 3 with experience (requires certificate)
- [ ] Test with missing resume
- [ ] Test with experience but no certificate
- [ ] Test with multiple documents
- [ ] Test without completing Step 2 first

---

## 🔗 Related Files

- **Controller**: `src/controllers/jobSeeker/jobSeeker.controller.js`
- **Routes**: `src/routes/jobSeeker/jobSeeker.routes.js`
- **Validation**: `src/validation/jobSeeker/jobSeeker.validation.js`
- **Model**: `src/models/jobSeeker/jobSeeker.model.js`
- **File Upload**: `src/middlewares/fileUpload.js`

---

**Last Updated**: Current implementation status as of now
**Status**: ✅ Core functionality complete, minor improvements needed

