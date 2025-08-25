# Rich Markdown Test Document

This document tests the rich markdown features including syntax highlighting and copy buttons.

## JavaScript Example

```javascript
// Fibonacci function with memoization
const fibonacci = (function() {
  const cache = {};
  
  return function fib(n) {
    if (n in cache) {
      return cache[n];
    }
    
    if (n <= 1) {
      return n;
    }
    
    cache[n] = fib(n - 1) + fib(n - 2);
    return cache[n];
  };
})();

console.log(fibonacci(10)); // 55
```

## TypeScript Example

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  roles: Role[];
}

enum Role {
  Admin = "ADMIN",
  User = "USER",
  Guest = "GUEST"
}

class UserService {
  private users: Map<number, User> = new Map();
  
  async createUser(data: Omit<User, 'id'>): Promise<User> {
    const id = Math.floor(Math.random() * 10000);
    const user: User = { id, ...data };
    this.users.set(id, user);
    return user;
  }
  
  getUser(id: number): User | undefined {
    return this.users.get(id);
  }
}
```

## Python Example

```python
import asyncio
from typing import List, Dict, Optional
from dataclasses import dataclass

@dataclass
class Task:
    id: int
    name: str
    priority: int
    completed: bool = False
    
    def __post_init__(self):
        if self.priority < 0 or self.priority > 10:
            raise ValueError("Priority must be between 0 and 10")

class TaskManager:
    def __init__(self):
        self.tasks: Dict[int, Task] = {}
        
    async def add_task(self, task: Task) -> None:
        await asyncio.sleep(0.1)  # Simulate async operation
        self.tasks[task.id] = task
        print(f"Task '{task.name}' added successfully")
        
    def get_pending_tasks(self) -> List[Task]:
        return [t for t in self.tasks.values() if not t.completed]
```

## Go Example

```go
package main

import (
    "context"
    "fmt"
    "sync"
    "time"
)

type Worker struct {
    id      int
    tasks   chan func()
    quit    chan bool
    wg      *sync.WaitGroup
}

func NewWorker(id int, wg *sync.WaitGroup) *Worker {
    return &Worker{
        id:    id,
        tasks: make(chan func(), 100),
        quit:  make(chan bool),
        wg:    wg,
    }
}

func (w *Worker) Start(ctx context.Context) {
    go func() {
        defer w.wg.Done()
        for {
            select {
            case task := <-w.tasks:
                task()
            case <-w.quit:
                return
            case <-ctx.Done():
                return
            }
        }
    }()
}
```

## Rust Example

```rust
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::RwLock;

#[derive(Debug, Clone)]
pub struct Cache<K, V> 
where 
    K: Clone + Eq + std::hash::Hash,
    V: Clone,
{
    data: Arc<RwLock<HashMap<K, V>>>,
    max_size: usize,
}

impl<K, V> Cache<K, V>
where
    K: Clone + Eq + std::hash::Hash,
    V: Clone,
{
    pub fn new(max_size: usize) -> Self {
        Self {
            data: Arc::new(RwLock::new(HashMap::new())),
            max_size,
        }
    }
    
    pub async fn get(&self, key: &K) -> Option<V> {
        let data = self.data.read().await;
        data.get(key).cloned()
    }
    
    pub async fn set(&self, key: K, value: V) {
        let mut data = self.data.write().await;
        if data.len() >= self.max_size {
            // Simple eviction: remove first item
            if let Some(first_key) = data.keys().next().cloned() {
                data.remove(&first_key);
            }
        }
        data.insert(key, value);
    }
}
```

## SQL Example

```sql
-- Complex query with CTEs and window functions
WITH monthly_sales AS (
    SELECT 
        DATE_TRUNC('month', order_date) as month,
        product_id,
        SUM(quantity * unit_price) as revenue,
        COUNT(DISTINCT customer_id) as unique_customers
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    WHERE order_date >= CURRENT_DATE - INTERVAL '1 year'
    GROUP BY 1, 2
),
ranked_products AS (
    SELECT 
        month,
        product_id,
        revenue,
        unique_customers,
        ROW_NUMBER() OVER (PARTITION BY month ORDER BY revenue DESC) as rank,
        LAG(revenue) OVER (PARTITION BY product_id ORDER BY month) as prev_month_revenue
    FROM monthly_sales
)
SELECT 
    month,
    product_id,
    revenue,
    unique_customers,
    rank,
    ROUND(((revenue - prev_month_revenue) / prev_month_revenue) * 100, 2) as growth_percentage
FROM ranked_products
WHERE rank <= 10
ORDER BY month DESC, rank;
```

## Bash Example

```bash
#!/bin/bash
set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to log messages with timestamps
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    exit 1
}

# Check if required commands exist
check_dependencies() {
    local deps=("git" "docker" "curl")
    for cmd in "${deps[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error "$cmd is not installed"
        fi
    done
    log "All dependencies satisfied"
}

# Main execution
main() {
    check_dependencies
    log "Starting deployment process..."
    # Additional deployment logic here
}

main "$@"
```

## JSON Example

```json
{
  "name": "dedpaste",
  "version": "1.8.0",
  "config": {
    "server": {
      "host": "0.0.0.0",
      "port": 8080,
      "ssl": {
        "enabled": true,
        "certPath": "/etc/ssl/certs/server.crt",
        "keyPath": "/etc/ssl/private/server.key"
      }
    },
    "database": {
      "type": "postgresql",
      "connection": {
        "host": "localhost",
        "port": 5432,
        "database": "dedpaste",
        "pool": {
          "min": 2,
          "max": 10
        }
      }
    },
    "features": {
      "markdown": true,
      "syntaxHighlighting": true,
      "copyButton": true
    }
  }
}
```

## YAML Example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dedpaste-deployment
  namespace: default
  labels:
    app: dedpaste
spec:
  replicas: 3
  selector:
    matchLabels:
      app: dedpaste
  template:
    metadata:
      labels:
        app: dedpaste
    spec:
      containers:
      - name: dedpaste
        image: dedpaste:1.8.0
        ports:
        - containerPort: 8080
        env:
        - name: NODE_ENV
          value: "production"
        - name: R2_BUCKET
          valueFrom:
            secretKeyRef:
              name: dedpaste-secrets
              key: r2-bucket
        resources:
          limits:
            memory: "256Mi"
            cpu: "500m"
          requests:
            memory: "128Mi"
            cpu: "250m"
```

## CSS Example

```css
/* Modern CSS with custom properties and animations */
:root {
  --primary-color: #3b82f6;
  --secondary-color: #8b5cf6;
  --background: #0a0a0a;
  --text-primary: #e5e7eb;
  --border-radius: 8px;
}

.code-block-wrapper {
  position: relative;
  margin: 1.5rem 0;
  border-radius: var(--border-radius);
  background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}

.copy-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.copy-button:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

@keyframes copied-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.copy-button.copied {
  animation: copied-pulse 0.3s ease;
  background: rgba(34, 197, 94, 0.2);
  border-color: rgb(34, 197, 94);
}
```

## Plaintext Example (No language specified)

```
This is a plain text code block without any language specification.
It should still be displayed with proper formatting and a copy button.

Features:
- No syntax highlighting
- Monospace font
- Copy button functionality
- Preserved whitespace and indentation
    - Nested indentation
    - Multiple levels
```

## End of Test Document

All code blocks above should have:
1. Syntax highlighting (except plaintext)
2. Language label in the header
3. Copy button that works
4. Proper dark theme styling