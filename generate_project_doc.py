from docx import Document
from datetime import datetime

filename = r'C:\xampp\htdocs\iElevate\iElevate_Project_Documentation.docx'
doc = Document()

# Title
p = doc.add_paragraph()
r = p.add_run('iElevate Project Documentation')
r.bold = True
r.font.size = 24

# Metadata
for label, value in [
    ('Project Name:', 'iElevate'),
    ('Prepared by:', 'Student Team / Developer'),
    ('Date:', datetime.now().strftime('%d-%m-%Y')),
    ('Project Type:', 'MVP Web Application'),
]:
    para = doc.add_paragraph()
    para.add_run(f'{label} {value}')

# Sections
sections = [
    ('1. Introduction', 'iElevate is a peer-to-peer skill exchange platform designed to help users learn and teach skills within a community. The platform allows users to create profiles, list skills they can teach or learn, find suitable matches, communicate, schedule sessions, and receive digital credentials based on completed exchanges.'),
    ('2. Problem Statement', 'Many people want to learn practical skills but struggle to find trusted and suitable partners. Existing learning systems are often formal, expensive, or not personalized. iElevate addresses this by creating a community-based platform where users can both teach and learn in a mutually beneficial environment.'),
    ('3. Objectives', 'The main objectives of the project are to: (1) connect learners with knowledgeable peers, (2) support both learning and teaching roles, (3) provide a simple matching mechanism, (4) enable communication and scheduling, (5) issue blockchain-based credentials for completed exchanges, and (6) provide a foundation for moderation and administrative oversight.'),
    ('4. System Overview', 'The application consists of a React frontend and an Express backend connected to a MySQL database. The frontend provides the user interface for registration, profile management, matching, sessions, messages, and credentials. The backend exposes APIs for authentication, user management, skills, matches, exchanges, sessions, and credentials.'),
    ('5. Functional Requirements', 'The platform allows users to sign up and log in, create a personal profile, add skills they can teach or learn, search for potential matches, propose skill exchanges, start conversations, schedule sessions, and track achievements. Users can receive credentials after successful learning exchanges and access an admin dashboard for oversight.'),
    ('6. Current Implementation Status', 'The current implementation provides a functional MVP of the proposed system. User authentication, profile management, matching, messaging, session scheduling, and a dashboard are all implemented. The project also includes database models and a credential service framework for blockchain integration. However, some advanced features remain partial or prototype-level.'),
    ('7. Matching Mechanism', 'The matching logic currently works by finding users who teach skills the current user wants to learn and users who want to learn skills the current user teaches. It calculates a simple reciprocal skill overlap score and converts this into a percentage displayed in the UI. This is a functional heuristic approach and not yet a fully advanced recommendation algorithm.'),
    ('8. Blockchain Credential Feature', 'The project includes support for blockchain-based credentials through a service layer that interacts with a smart contract. The system is designed to mint credentials once a skill exchange is completed. However, it requires a real deployed contract and valid wallet configuration to become fully operational in a live environment.'),
    ('9. Admin and Moderation Features', 'The system includes an admin dashboard and dispute management routes. These provide the foundation for monitoring users, handling issues, and reviewing disputes. These features are available as part of the project structure but may require further development to become fully complete administrative workflows.'),
    ('10. Strengths', 'The project demonstrates a clear and practical concept, good system architecture, modular backend design, a usable user interface, and a realistic database schema. It successfully shows how the platform could operate as a working prototype.'),
    ('11. Limitations', 'The website still has some limitations. The matching engine is relatively simple, the blockchain integration is not fully deployed, and several advanced features remain part of the MVP stage. Therefore, the project should be viewed as a functioning prototype rather than a fully commercial-ready system.'),
    ('12. Conclusion', 'Overall, iElevate meets the core objectives of the proposed system at an MVP level. It provides a strong foundation for a skill exchange platform and demonstrates the key features needed to connect users, facilitate skill-sharing, and support credentials and administration. With further refinement, it could evolve into a more sophisticated and production-ready platform.'),
]

for title, text in sections:
    doc.add_heading(title, level=1)
    doc.add_paragraph(text)

# Final signature block
para = doc.add_paragraph()
para.add_run('\nPrepared for project documentation and evaluation.\n')

# Save the document
try:
    doc.save(filename)
    print(f'Document created successfully: {filename}')
except Exception as exc:
    print(f'Error creating document: {exc}')
