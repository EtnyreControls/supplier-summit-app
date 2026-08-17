# Supplier Summit Digital Experience

## Overview

The Supplier Summit Digital Experience is a mobile-first web application designed to modernize supplier engagement before, during, and after the Supplier Summit. Rather than relying on multiple disconnected tools for registration, polling, Q&A, networking, and feedback collection, this platform brings these features together into a single, intuitive experience.

The project also serves as a demonstration of our digital transformation efforts. While artificial intelligence is incorporated into the application, it is only used where it provides clear value to users. Traditional software solutions are preferred whenever they can accomplish the same task with less complexity. The overall goal is to improve the attendee experience while maintaining transparency, security, and trust.

## Project Goals

The application aims to:

* Provide a simple and responsive experience across all modern devices.
* Increase attendee engagement throughout the event.
* Collect valuable feedback from suppliers.
* Enable live interaction through polls and Q&A.
* Simplify networking by allowing attendees to share contact information digitally.
* Generate useful post-event insights for organizers.
* Demonstrate practical and responsible use of AI technologies.

## Key Features

### Secure Authentication

Each attendee receives a unique QR code before the event. Scanning the QR code automatically authenticates the user and opens the event portal without requiring additional login steps. If QR scanning is unavailable, a secure fallback login method is provided to ensure attendees can still access the platform.

### Mobile-First Design

The application is designed primarily for mobile devices since attendees will interact with it throughout the event using their phones. The interface remains fully responsive on tablets and desktops while prioritizing a clean, touch-friendly experience.

### Live Polling

Speakers and organizers can launch polls during presentations, allowing attendees to vote in real time. Results update instantly without requiring page refreshes, encouraging participation and creating a more interactive event.

### Feedback Collection

Attendees can submit ratings and comments for individual sessions as well as overall event feedback. Forms are intentionally designed to minimize typing while still collecting meaningful information.

### Q&A Management

Participants can submit questions throughout presentations and upvote questions submitted by others. Moderators can review incoming questions before displaying them to presenters, helping maintain relevance and organization.

### Digital Contact Sharing

Networking is simplified by allowing attendees to choose exactly which information they want to share with others. Rather than exchanging business cards, participants can securely share digital contact details including their name, company, title, email, LinkedIn profile, and optional phone number.

### AI-Powered Features

Artificial intelligence is intentionally limited to scenarios where it offers measurable benefits. Planned AI functionality includes:

* Answering attendee questions using an approved FAQ knowledge base.
* Summarizing large volumes of event feedback.
* Identifying recurring themes across survey responses.
* Producing post-event insight reports for organizers.

The AI does not generate unrestricted responses. Instead, it uses Retrieval-Augmented Generation (RAG) to answer questions only from approved event documentation. Questions outside the supported knowledge base are redirected to the appropriate speaker or event staff.

## Functional Requirements

The system must:

* Authenticate users securely.
* Support automatic login through QR code scanning.
* Provide a manual authentication fallback.
* Operate on all modern browsers.
* Maintain a responsive mobile-first interface.
* Allow participation in live polls.
* Support live Q&A sessions.
* Collect attendee feedback.
* Enable optional contact sharing.
* Clearly indicate when AI is being used.
* Explain what user information is stored and why.
* Minimize manual data entry wherever possible.

## Non-Functional Requirements

The application should prioritize reliability, usability, and security throughout the event.

Key quality attributes include:

* Fast page load times.
* Responsive performance under concurrent usage.
* Secure authentication and authorization.
* Protection of attendee information.
* High availability during the event.
* Accessibility across devices and screen sizes.
* Simple, intuitive workflows requiring minimal training.

## Technology Stack

### Frontend

**Next.js** was selected as the frontend framework because it provides excellent performance, built-in routing, server-side rendering, and a mature React ecosystem. Combined with responsive design principles, it enables a fast and reliable user experience across devices.

### QR Code Generation

**React QR Code** generates SVG-based QR codes directly in the browser without requiring additional backend services. The library is lightweight, actively maintained, and integrates naturally with React.

### Backend

**FastAPI** powers the backend REST API. It offers excellent performance, automatic request validation through Pydantic, asynchronous processing, and seamless integration with Python-based AI libraries.

### Database

**Supabase** provides a managed PostgreSQL database with integrated authentication, Row-Level Security, storage, and real-time capabilities. Consolidating these services simplifies the overall architecture while maintaining enterprise-grade security.

### Authentication

Authentication is handled using **Supabase Auth**, providing secure JWT-based sessions and role-based access control integrated directly with the database.

### Artificial Intelligence

AI functionality is implemented using **Hugging Face Transformers**, allowing models to run within organizational infrastructure rather than relying on third-party AI APIs. This approach provides greater control over supplier data and supports future customization.

### Vector Search

Instead of introducing a separate vector database, the project uses **pgvector**, a PostgreSQL extension that stores embeddings alongside application data. This simplifies deployment while benefiting from PostgreSQL's existing security and backup mechanisms.

### Real-Time Updates

**Supabase Realtime** enables live updates for polling, Q&A, and engagement metrics using PostgreSQL's Write-Ahead Log replication. Connected clients receive updates automatically without refreshing the page.

### Analytics

Event analytics will initially be implemented using **Chart.js**, providing lightweight interactive dashboards for participation rates, polling activity, and attendee feedback. AI-generated summaries may be incorporated in future iterations.

### Testing

Testing combines several tools to ensure software quality:

* **Pytest** for backend unit and integration testing.
* **Postman** for API validation.
* **k6** for load and performance testing.
* Additional frontend and end-to-end testing may be incorporated as development progresses.

## High-Level Architecture

```text
                    Suppliers
                        │
                Mobile Web Browser
                        │
                  Next.js Frontend
                        │
          REST API + WebSocket Connections
                        │
                  FastAPI Backend
          ┌─────────────┴─────────────┐
          │                           │
 Supabase PostgreSQL + pgvector   Hugging Face Models
          │
   Supabase Realtime Services
```

## Security Considerations

Security is incorporated throughout the application's design.

* HTTPS is enforced for all communication.
* Authentication is handled using secure JWT tokens.
* PostgreSQL Row-Level Security restricts access to attendee data.
* User permissions are enforced through backend authorization.
* AI responses are restricted to approved event documentation.
* Personal information shared between attendees is always user-controlled.
* Sensitive configuration values are stored using environment variables rather than source code.

## Future Enhancements

Potential future improvements include personalized agendas, AI-assisted networking recommendations, Microsoft Entra ID integration, push notifications, multi-event support, advanced analytics dashboards, speaker performance reporting, and expanded administrative tooling.

## Development Philosophy

This project emphasizes practical digital transformation rather than technology for its own sake. Every feature is designed to reduce friction, improve engagement, and provide measurable value to attendees and organizers. AI is treated as an enhancement rather than a replacement for conventional software, ensuring the application remains transparent, reliable, and easy to use.
