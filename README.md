# Todo Application

A robust Todo API service built with Node.js, featuring MongoDB for storage, Redis for caching, and Kafka for event handling.

## Features

- CRUD operations for todos
- Status and priority management
- Filtering and sorting capabilities
- Bulk update operations
- Soft delete with restore capability
- Statistics and analytics
- Optimistic concurrency control

## Prerequisites

- Docker
- Docker Compose

## Quick Start

1. Clone the repository:

```bash
git clone https://github.com/stiffinWanjohi/todo-api.git
cd todo-app
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Configure your `.env` file:

```env
# General Application Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=*

# Database (MongoDB) Configuration
MONGODB_URI=mongodb://mongodb:27017/todo_app
MONGODB_TEST_URI=mongodb://mongodb:27017/todo_test

# Kafka Configuration
KAFKA_CLIENT_ID=todo-api
KAFKA_BROKER=kafka:29092
KAFKA_SSL=false
KAFKA_USERNAME=
KAFKA_PASSWORD=

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URI=redis://redis:6379
```

4. Run the application:

```bash
docker-compose up -d
```

The app will be available at `http://localhost:3000`

## API Documentation

### Query Todos

Get a list of todos with optional filtering and sorting.

```bash
# Get all todos
GET /api/v1/todos

# Get todos with filters
GET /api/v1/todos?status={status}&priority={priority}&page={page}&limit={limit}&sortBy={field}&sortOrder={order}&assignedTo={userId}&createdBy={userId}&tags={tag1,tag2}&startDate={startDate}&endDate={endDate}
```

Query Parameters:

- `status`: PENDING, IN_PROGRESS, COMPLETED, ARCHIVED
- `priority`: LOW, MEDIUM, HIGH, URGENT
- `page`: Page number for pagination
- `limit`: Number of items per page
- `sortBy`: Field to sort by
- `sortOrder`: asc, desc
- `assignedTo`: User ID
- `createdBy`: User ID
- `tags`: Comma-separated list of tags
- `startDate`: ISO date string
- `endDate`: ISO date string

### Get Single Todo

```bash
GET /api/v1/todos/:id
```

### Create Todo

```bash
POST /api/v1/todos
Content-Type: application/json

{
    "title": "Complete API Documentation",
    "description": "Write comprehensive API documentation",
    "status": "PENDING",
    "priority": "HIGH",
    "dueDate": "2024-02-01T00:00:00Z",
    "tags": ["documentation", "api"],
    "assignedTo": "user123",
    "createdBy": "admin456"
}
```

### Update Todo

```bash
PUT /api/v1/todos/:id
Content-Type: application/json

{
    "title": "Updated API Documentation",
    "status": "COMPLETED",
    "priority": "MEDIUM",
    "version": 1  // Required for optimistic concurrency control
}
```

### Delete Todo

```bash
DELETE /api/v1/todos/:id
```

### Bulk Update Todos

```bash
POST /api/v1/todos/bulk
Content-Type: application/json

{
    "ids": ["id_1", "id_2"],
    "update": {
        "status": "IN_PROGRESS",
        "priority": "HIGH",
        "tags": ["urgent", "sprint2"]
    }
}
```

### Restore Todo

```bash
POST /api/v1/todos/:id/restore
```

### Get Todo Statistics

```bash
GET /api/v1/todos/statistics
```

Response:

```json
{
	"totalTodos": 100,
	"completedTodos": 45,
	"pendingTodos": 30,
	"inProgressTodos": 25,
	"highPriorityTodos": 15,
	"overdueTodos": 5
}
```

### Health Check

```bash
GET /health
```

## Data Models

### Todo Status

```typescript
enum TodoStatus {
	PENDING = "PENDING",
	IN_PROGRESS = "IN_PROGRESS",
	COMPLETED = "COMPLETED",
	ARCHIVED = "ARCHIVED",
}
```

### Todo Priority

```typescript
enum TodoPriority {
	LOW = "LOW",
	MEDIUM = "MEDIUM",
	HIGH = "HIGH",
	URGENT = "URGENT",
}
```

### Todo Interface

```typescript
interface ITodo {
	_id?: string;
	title: string;
	description?: string;
	status: TodoStatus;
	priority: TodoPriority;
	dueDate?: Date;
	tags?: string[];
	assignedTo?: string;
	createdBy: string;
	createdAt?: Date;
	updatedAt?: Date;
	completedAt?: Date;
	isDeleted?: boolean;
	version?: number;
}
```

## Project Structure

```
todo-api/
├── docker/                     # Docker configuration files
│   ├── api/
│       └── Dockerfile         # API service Dockerfile
├── src/
│   ├── config/               # Configuration files
│   │   ├── database.ts       # MongoDB configuration
│   │   ├── redis.ts         # Redis configuration
│   │   ├── kafka.ts         # Kafka configuration
│   │   └── app.ts           # App configuration
│   ├── controllers/          # Request handlers
│   │   └── todo.controller.ts
│   ├── services/            # Business logic layer
│   │   └── todo.service.ts
│   ├── models/              # Database models
│   │   └── todo.model.ts
│   ├── interfaces/          # TypeScript interfaces
│   │   ├── todo.interface.ts
│   │   └── response.interface.ts
│   ├── middleware/          # Express middleware
│   │   ├── error.middleware.ts
│   │   ├── validation.middleware.ts
│   │   └── cache.middleware.ts
│   ├── utils/              # Utility functions
│   │   ├── logger.ts       # Logging utility
│   │   ├── error-codes.ts  # Error code definitions
│   │   └── response-handler.ts
│   ├── events/             # Event handling
│   │   ├── producers/      # Kafka producers
│   │   │   └── todo.producer.ts
│   │   └── consumers/      # Kafka consumers
│   │       └── todo.consumer.ts
│   ├── app.ts             # Express app setup
│   └── index.ts           # Application entry point
├── tests/                 # Test files
│   ├── integration/       # Integration tests
│   └── unit/             # Unit tests
│       └── todo.service.test.ts
├── docker-compose.yml     # Docker compose configuration
├── package.json          # Project dependencies
├── tsconfig.json         # TypeScript configuration
├── jest.config.js        # Jest test configuration
└── README.md            # Project documentation
```

## Error Handling

The API returns standard HTTP status codes with error responses:

```json
{
	"error": "Error message",
	"code": "ERROR_CODE",
	"details": {}
}
```

## Troubleshooting

If you encounter any issues:

1. Check container status:

```bash
docker ps
```

2. View logs:

```bash
docker-compose logs -f
```

3. Restart services:

```bash
docker-compose restart
```
