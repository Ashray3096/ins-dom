# Data Modeling & Document Extraction Platform

A comprehensive web application for uploading documents (HTML, PDF, Email), creating extraction templates, and building dimensional data models with interactive ER diagram visualization.

## Overview

This platform enables users to:
- Upload and manage source documents (HTML, PDF, .eml files)
- Create extraction templates by selecting elements from documents
- Define entities and their attributes
- Model relationships between entities with cardinality
- Configure dimensions (including SCD types) and fact tables
- Visualize the complete data model as an interactive ER diagram

## Key Features

### 1. Document Management
- **Multi-format Support**: Upload HTML, PDF, and email (.eml) files
- **Secure Storage**: Files stored in Supabase Storage with signed URLs
- **Interactive Viewers**:
  - HTML viewer with element selection
  - PDF viewer with page navigation and zoom controls
  - Email viewer with header/body display and attachment list

### 2. Template Creation
- **Visual Selection**: Click elements in HTML or select text in PDFs/emails
- **XPath Generation**: Automatic XPath generation for HTML elements
- **Text Capture**: Capture text selections from PDFs and emails
- **Reusable Templates**: Save templates for repeated extractions

### 3. Entity Modeling
- **Entity Definition**: Create entities (tables) with names and descriptions
- **Attribute Management**: Add attributes with data types (string, number, date, boolean)
- **Source Mapping**: Link attributes to template selections for extraction
- **Multiple Sources**: Support multiple source files per entity

### 4. Relationship Modeling
- **Visual Relationship Builder**: Define relationships between entities
- **Cardinality**: Specify relationship types (1:1, 1:N, N:1, N:M)
- **Bidirectional**: Set relationship labels for both directions
- **Validation**: Prevent duplicate relationships

### 5. Dimensional Modeling
- **Dimension Configuration**:
  - Define dimension tables with SCD types (0, 1, 2, 3)
  - Mark natural keys and business keys
  - Configure slowly changing dimension behavior
- **Fact Tables**:
  - Define fact tables with grain description
  - Add measures with aggregation types (SUM, AVG, COUNT, MIN, MAX)
  - Link dimensions to facts with foreign keys

### 6. ER Diagram Visualization
- **Interactive Diagram**: Drag-and-drop node-based visualization
- **Entity Nodes**: Display entities with attributes and types
- **Relationship Edges**: Show relationships with cardinality labels
- **Dimension/Fact Indicators**: Visual badges for dimensions (with SCD type) and facts
- **Auto Layout**: Automatic hierarchical layout algorithm
- **Zoom & Pan**: Navigate large diagrams with controls

## Technology Stack

### Frontend
- **Next.js 15**: React framework with App Router and Turbopack
- **TypeScript**: Strict typing for type safety
- **Tailwind CSS 4**: Utility-first styling
- **Shadcn UI**: High-quality UI component library
- **React Flow (@xyflow/react)**: Interactive node-based diagrams
- **react-pdf / PDF.js**: Client-side PDF rendering
- **mailparser**: Email (.eml) parsing

### Backend
- **Next.js API Routes**: Serverless API endpoints
- **Supabase**:
  - PostgreSQL database with Row Level Security (RLS)
  - Authentication (email/password)
  - Storage (file uploads with signed URLs)

### Development
- **Turbopack**: Fast development builds
- **ESLint**: Code linting
- **Git**: Version control

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account and project

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ins-dom
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Set up Supabase database**

   Run the SQL schema (see Database Schema section below) in your Supabase SQL Editor.

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open application**

   Navigate to `http://localhost:3000`

## Database Schema

### Tables

#### `users`
- User profiles (linked to Supabase Auth)
- Fields: `id`, `email`, `full_name`, `created_at`

#### `projects`
- Top-level project containers
- Fields: `id`, `name`, `description`, `owner_id`, `created_at`, `updated_at`

#### `source_files`
- Uploaded documents
- Fields: `id`, `project_id`, `name`, `type` (html/pdf/email), `storage_path`, `created_at`

#### `templates`
- Extraction templates
- Fields: `id`, `file_id`, `name`, `selections` (JSON array of XPath/text pairs), `created_at`

#### `entities`
- Entity definitions (tables)
- Fields: `id`, `project_id`, `name`, `description`, `created_at`

#### `attributes`
- Entity attributes (columns)
- Fields: `id`, `entity_id`, `name`, `data_type`, `template_selection_index`, `source_file_id`

#### `relationships`
- Entity relationships
- Fields: `id`, `project_id`, `from_entity_id`, `to_entity_id`, `cardinality`, `from_label`, `to_label`

#### `dimensions`
- Dimension table configurations
- Fields: `id`, `entity_id`, `is_dimension`, `scd_type`, `natural_key`, `business_key`

#### `facts`
- Fact table configurations
- Fields: `id`, `entity_id`, `is_fact`, `grain_description`

#### `fact_measures`
- Measures in fact tables
- Fields: `id`, `fact_id`, `name`, `aggregation_type`

#### `fact_dimensions`
- Links between facts and dimensions
- Fields: `id`, `fact_id`, `dimension_id`, `foreign_key_name`

### Row Level Security (RLS)

All tables have RLS enabled with policies that ensure:
- Users can only access their own projects and related data
- Authentication required for all operations
- Automatic user_id/owner_id validation

## User Guide

### 1. Create a Project

1. Navigate to Projects page
2. Click "Create Project"
3. Enter project name and description
4. Click "Create"

### 2. Upload Documents

1. Open a project
2. Click "Upload File"
3. Select file type (HTML, PDF, or Email)
4. Choose file(s) from your computer
5. Click "Upload"

### 3. Create Extraction Template

**For HTML files:**
1. Click on uploaded HTML file
2. Click "Enable Selection"
3. Click elements in the document to select them
4. Selected elements appear in the right panel
5. Click "Create Template" and enter a name

**For PDF files:**
1. Click on uploaded PDF file
2. Use navigation controls to find desired page
3. Click "Enable Selection"
4. Select text with your mouse
5. Click "Capture Selection" button
6. Repeat for additional selections
7. Click "Create Template" and enter a name

**For Email files:**
1. Click on uploaded .eml file
2. Click "Enable Selection"
3. Select text from email body
4. Click "Capture Selection" button
5. Repeat for additional selections
6. Click "Create Template" and enter a name

### 4. Define Entities

1. Navigate to "Entities" tab in project
2. Click "Add Entity"
3. Enter entity name and description
4. Click "Create"
5. Add attributes:
   - Click "Add Attribute"
   - Enter attribute name
   - Select data type
   - Optionally map to template selection
   - Optionally link to source file

### 5. Model Relationships

1. Navigate to "Relationships" tab
2. Click "Add Relationship"
3. Select "From Entity"
4. Select "To Entity"
5. Choose cardinality (1:1, 1:N, N:1, N:M)
6. Enter relationship labels for both directions
7. Click "Create"

### 6. Configure Dimensions & Facts

**For Dimensions:**
1. Navigate to "Dimensions & Facts" tab
2. Select an entity
3. Check "Mark as Dimension"
4. Select SCD Type (0, 1, 2, or 3)
5. Enter natural key and business key
6. Click "Save"

**For Facts:**
1. Navigate to "Dimensions & Facts" tab
2. Select an entity
3. Check "Mark as Fact"
4. Enter grain description
5. Add measures:
   - Click "Add Measure"
   - Enter measure name
   - Select aggregation type
6. Link dimensions:
   - Click "Add Dimension"
   - Select dimension entity
   - Enter foreign key name
7. Click "Save"

### 7. Visualize ER Diagram

1. Navigate to "ER Diagram" tab
2. View interactive diagram with:
   - Entity nodes (with attributes)
   - Relationship edges (with cardinality)
   - Dimension/Fact badges
   - SCD type indicators
3. Drag nodes to rearrange
4. Click "Auto Layout" for automatic positioning
5. Use zoom controls to navigate

## Project Structure

```
ins-dom/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── jira/           # Jira API routes (optional)
│   │   ├── auth/
│   │   │   ├── login/          # Login page
│   │   │   └── signup/         # Signup page
│   │   ├── projects/
│   │   │   ├── page.tsx        # Projects list
│   │   │   └── [id]/
│   │   │       ├── page.tsx    # Project dashboard
│   │   │       ├── entities/   # Entity modeling pages
│   │   │       ├── relationships/ # Relationship pages
│   │   │       ├── dimensions/ # Dimensions & facts pages
│   │   │       ├── er-diagram/ # ER diagram page
│   │   │       └── files/
│   │   │           └── [fileId]/
│   │   │               ├── page.tsx      # File viewer
│   │   │               └── template/
│   │   │                   └── page.tsx  # Template creator
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Home page
│   ├── components/
│   │   ├── ui/                 # Shadcn UI components
│   │   ├── PdfViewer.tsx       # PDF viewer component
│   │   ├── EmailViewer.tsx     # Email viewer component
│   │   └── ERDiagram.tsx       # ER diagram component
│   ├── lib/
│   │   ├── supabase.ts         # Supabase client
│   │   ├── emailParser.ts      # Email parsing utilities
│   │   └── utils.ts            # Utility functions
│   ├── contexts/
│   │   └── AuthContext.tsx     # Authentication context
│   └── types/
│       └── database.ts         # TypeScript database types
├── public/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── README.md                   # This file
```

## Visual Design

### Color Scheme
- **Primary**: Blue (#3b82f6)
- **Success**: Green (#10b981)
- **Warning**: Yellow (#f59e0b)
- **Error**: Red (#ef4444)
- **Background**: Gray-50 (#f9fafb)
- **Cards**: White (#ffffff)

### Typography
- **Headings**: Inter font, bold weights
- **Body**: Inter font, regular weight
- **Code/XPath**: Monospace font

### Components
- Card-based layouts with subtle shadows
- Button variants: default, outline, secondary, destructive
- Form inputs with focus states
- Loading spinners for async operations
- Toast notifications for user feedback

## Security

### Authentication
- Supabase Auth with email/password
- JWT-based sessions
- Protected routes with auth context

### Authorization
- Row Level Security (RLS) on all tables
- User-based data isolation
- Automatic owner_id validation

### File Storage
- Signed URLs with expiration (1 hour)
- Bucket-level security policies
- Sandboxed iframes for HTML/email content

### Input Validation
- TypeScript type checking
- Form validation with error messages
- SQL injection prevention (parameterized queries)

## Known Limitations

### Email Support
- **.msg files**: Limited support for uploaded files (requires binary parsing from File object)
- **Attachments**: Display only (no download/preview)
- **Inline images**: Not rendered in email body

### PDF Support
- **Selection**: Text-based only (no coordinate tracking or image selection)
- **Page numbers**: Not tracked for selections
- **Forms**: No form field extraction

### General
- **Extraction**: Templates define structure but extraction not automated
- **Validation**: No real-time XPath validation
- **Performance**: Large PDFs may load slowly

## Future Enhancements

### Phase 9: Data Extraction Engine
- Automated extraction using templates
- Batch processing of multiple files
- Error handling and validation
- Export extracted data (CSV, JSON, Excel)

### Phase 10: Advanced Features
- Template versioning
- Collaborative editing
- Data quality rules
- Transformation logic
- Scheduling and automation

### Phase 11: Integrations
- Connect to data warehouses
- API endpoints for external systems
- Webhook notifications
- Third-party authentication (OAuth)

## Contributing

### Development Workflow

1. Create a feature branch
2. Make changes with descriptive commits
3. Test thoroughly locally
4. Submit pull request with description
5. Address review feedback

### Code Standards

- **TypeScript**: Use strict typing, avoid `any`
- **Components**: Functional components with hooks
- **Naming**: camelCase for functions/variables, PascalCase for components
- **Formatting**: Follow ESLint rules
- **Comments**: Document complex logic

### Testing

- Test all new features manually
- Verify authentication flows
- Check RLS policies
- Test file uploads and storage
- Validate form submissions

## Commands

```bash
# Development
npm run dev          # Start dev server (port 3000)
npm run build        # Build production bundle
npm run start        # Start production server
npm run lint         # Run ESLint

# Database
# Run SQL scripts in Supabase SQL Editor

# Deployment
# Deploy to Vercel, Netlify, or other Next.js hosts
```

## Support

For issues, questions, or contributions, please refer to the project repository.

## License

[Specify your license here]

---

**Built with Next.js, Supabase, and React Flow**
