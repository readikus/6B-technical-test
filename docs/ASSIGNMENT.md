<p align="left">
  <a href="https://6b.digital" target="_blank">
    <img src="https://dashboard.6b.digital/storage/images/logo.png" alt="6B Digital" width="80" />
  </a>
</p>

This is a fictitious client and the requirements below form part of a technical assessment. The exercise is designed to evaluate your approach to problem solving, code quality, and system design rather than to represent a real production system.


## Overview
SixBee HealthTech is a healthcare technology company operating in West Yorkshire. Currently, all appointments are managed over the phone and manually entered by a practice receptionist.
SixBee HealthTech would like to automate this process.

## Aims
1. Automate a patient appointment booking system  
2. Create a patient facing form for appointments  
3. Build a simple practice admin area behind a login screen  
4. Display appointments in a table view ordered by date  
5. Provide functionality to edit and approve appointments  

## Technology Requirements
- The system should be built using a tech stack of your choice, preferably .NET, PHP or Node,js. We also accept Java or Python.    
- The database should use MySQL, MSSQL or PostgreSQL.

### Nice to Have
- Tailwind styling
- Containerised setup (e.g. Docker / Docker Compose)
- Unit tests

## Patient Facing Form
Create a simple form that submits and saves appointment data to a database. This data will be used in the admin area.

### Required Fields
- **Name** (required)  
- **Appointment Date and Time** (required)  
- **Desc** (required)  
- **Contact Number** (required)  
- **Email Address** (required)  

## Admin Area
The admin area should be protected behind a login system.

### Authentication
- Login form must include:
  - Email Address  
  - Password  
- A registration flow is **not required**  
- Credentials should be stored in the database  
- You may:
  - Manually insert a user into the database  
  - Or create a seeder to populate a user during setup  

## Admin Features
### Appointments Table
- A simple table listing all appointments  
- Ordered by appointment date  
- Columns should match the patient form fields  

### Actions Column
Each row should include:
- **Approve**
  - Tick icon or button  
  - When approved, the row should change colour  
- **Edit**
  - Opens an edit screen  
  - Form contains the same fields as the patient form  
  - Fields are pre populated  
  - Changes should save and reflect in the table  
- **Delete**
  - Removes the appointment  

### Navigation
- Include a navigation bar  
- Provide a logout option  

## Source Control
- The project must be hosted in a **public GitHub repository** from the start  
- Commit regularly after completing each feature  
- Commit history should clearly show progress  

### Important
- Timestamps are important to understand how long each section took  
- If you take breaks:
  - Create a commit marking the start of the break  
  - Create another commit when you resume  

> Please invite: **thomaseyles93** & **davidrabbich81**

## Additional Notes
- Use your judgement to ensure the solution is:
  - Functional for users  
  - Maintainable for developers  
  - Easy to extend in future  

- Use of Coding agents is neither discouraged or encouraged.  We believe in the right tool for the right job.  Our only requirement is that you must be able to justify and explain your architectural decisions

- Aim to meet the core requirements rather than over engineering  

## Time Expectation

- Please do not spend more than **3 hours** on this test  

