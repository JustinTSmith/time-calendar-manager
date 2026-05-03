.PHONY: help dev up down db-reset db-seed db-migrate db-generate db-studio

help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

dev: ## Start DB + Redis + both app servers
	docker compose up -d postgres redis
	pnpm turbo dev

up: ## Start infrastructure services (postgres + redis)
	docker compose up -d postgres redis

down: ## Stop all services
	docker compose down

db-reset: ## Drop and recreate DB, run migrations
	docker compose exec postgres psql -U tasktime -d postgres -c "DROP DATABASE IF EXISTS tasktime; CREATE DATABASE tasktime;"
	cd packages/db && pnpm drizzle-kit migrate

db-seed: ## Run seed script
	@echo "Seed script not yet implemented"
	# cd packages/db && pnpm seed

db-migrate: ## Run migrations
	cd packages/db && pnpm drizzle-kit migrate

db-generate: ## Generate migration files
	cd packages/db && pnpm drizzle-kit generate

db-studio: ## Open Drizzle Studio
	cd packages/db && pnpm drizzle-kit studio

tools: ## Start optional tools (pgAdmin)
	docker compose --profile tools up -d pgadmin
