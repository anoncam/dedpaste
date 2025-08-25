# Mermaid Diagram Test Document

This document tests Mermaid.js integration with various diagram types. Each diagram can be toggled between code view and rendered diagram view.

## Flowchart Example

```mermaid
flowchart TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> E[Fix issues]
    E --> B
    C --> F[Deploy]
    F --> G[End]
    
    style A fill:#8f8fff,stroke:#fff,stroke-width:2px
    style G fill:#10b981,stroke:#fff,stroke-width:2px
```

## Sequence Diagram Example

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Server
    participant Database
    
    User->>Browser: Click "View Diagram"
    Browser->>Browser: Load Mermaid.js
    Browser->>Server: Request paste content
    Server->>Database: Query paste
    Database-->>Server: Return content
    Server-->>Browser: Send markdown
    Browser->>Browser: Render diagram
    Browser-->>User: Display result
    
    Note over Browser: Mermaid renders client-side
```

## Class Diagram Example

```mermaid
classDiagram
    class PasteService {
        +String id
        +String content
        +Date createdAt
        +boolean isOneTime
        +create()
        +retrieve()
        +delete()
    }
    
    class EncryptionService {
        +String algorithm
        +encrypt(data)
        +decrypt(data)
        +generateKey()
    }
    
    class MarkdownRenderer {
        +marked renderer
        +highlightjs instance
        +mermaid config
        +render(markdown)
        +renderCodeBlock(code, lang)
    }
    
    PasteService --> EncryptionService : uses
    PasteService --> MarkdownRenderer : uses
```

## State Diagram Example

```mermaid
stateDiagram-v2
    [*] --> CodeView
    CodeView --> DiagramView: Click "View Diagram"
    DiagramView --> CodeView: Click "View Code"
    
    CodeView: Shows mermaid source
    CodeView: Syntax highlighted
    CodeView: Copy button available
    
    DiagramView: Renders SVG diagram
    DiagramView: Interactive elements
    DiagramView: Dark theme applied
    
    DiagramView --> [*]: Close paste
    CodeView --> [*]: Close paste
```

## Gantt Chart Example

```mermaid
gantt
    title DedPaste Feature Development
    dateFormat  YYYY-MM-DD
    section Markdown Support
    Basic rendering           :done,    des1, 2024-01-01, 2024-01-15
    Syntax highlighting       :done,    des2, 2024-01-16, 2024-01-25
    Copy button              :done,    des3, 2024-01-26, 2024-02-01
    section Mermaid Support
    Research                 :done,    des4, 2024-02-01, 2024-02-05
    Implementation           :active,  des5, 2024-02-06, 2024-02-10
    Testing                  :         des6, 2024-02-11, 2024-02-15
    Deployment              :         des7, 2024-02-16, 2024-02-20
```

## Pie Chart Example

```mermaid
pie title Language Usage in DedPaste
    "JavaScript" : 45
    "TypeScript" : 30
    "Python" : 15
    "Go" : 5
    "Other" : 5
```

## Entity Relationship Diagram

```mermaid
erDiagram
    PASTE ||--o{ METADATA : has
    PASTE {
        string id PK
        blob content
        string contentType
        timestamp createdAt
        boolean isOneTime
    }
    METADATA {
        string pasteId FK
        string key
        string value
        timestamp updatedAt
    }
    USER ||--o{ PASTE : creates
    USER {
        string id PK
        string publicKey
        timestamp lastSeen
    }
    PASTE ||--o{ ACCESS_LOG : tracks
    ACCESS_LOG {
        string id PK
        string pasteId FK
        string ipAddress
        timestamp accessedAt
    }
```

## Git Graph Example

```mermaid
gitGraph
    commit
    commit
    branch feature/markdown
    checkout feature/markdown
    commit
    commit
    checkout main
    merge feature/markdown
    branch feature/mermaid
    checkout feature/mermaid
    commit
    commit
    checkout main
    merge feature/mermaid
    commit
```

## User Journey Example

```mermaid
journey
    title User Creating an Encrypted Paste
    section Create Paste
      Write content: 5: User
      Select encryption: 3: User
      Choose recipient: 4: User
    section Upload Process
      Encrypt locally: 5: Browser
      Upload to server: 4: Browser, Server
      Store in R2: 5: Server
    section Share Link
      Copy URL: 5: User
      Send to recipient: 4: User
      Recipient decrypts: 3: Recipient
```

## Mind Map Example (if supported)

```mermaid
mindmap
  root((DedPaste))
    Features
      Encryption
        RSA/AES Hybrid
        PGP Support
        End-to-End
      Markdown
        Syntax Highlighting
        Copy Button
        Mermaid Diagrams
      Storage
        Cloudflare R2
        KV Metadata
        One-time pastes
    Technologies
      Frontend
        TypeScript
        Tailwind CSS
        Highlight.js
        Mermaid.js
      Backend
        Cloudflare Workers
        Edge Runtime
        Wrangler CLI
    Use Cases
      Secure Sharing
      Code Snippets
      Documentation
      Diagrams
```

## Regular Code Block (Non-Mermaid)

For comparison, here's a regular JavaScript code block that should still have syntax highlighting:

```javascript
// This is not a mermaid diagram
function renderMermaid(content) {
  const mermaidBlocks = content.match(/```mermaid([\s\S]*?)```/g);
  
  if (mermaidBlocks) {
    mermaidBlocks.forEach(block => {
      console.log('Found mermaid block:', block);
    });
  }
  
  return content;
}
```

## Testing Notes

1. Each Mermaid code block should have a "View Diagram" button
2. Clicking the button should render the diagram
3. The button should change to "View Code" when showing the diagram
4. Copy button should still work for copying the Mermaid source
5. Dark theme should be applied to all diagrams
6. Diagrams should be responsive and fit within the container