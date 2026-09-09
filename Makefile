SHELL := /bin/zsh
.DEFAULT_GOAL := help

.PHONY: help install up down logs reset db-migrate db-seed os-init dev dev-api dev-worker dev-web test lint build

help: ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Instala dependencias de backend y frontend
	cd backend && npm install
	cd frontend && npm install

up: ## Levanta postgres, rabbitmq y opensearch
	docker compose up -d postgres rabbitmq opensearch
	@echo "Esperando healthchecks..."
	@until [ "$$(docker inspect -f '{{.State.Health.Status}}' search-postgres 2>/dev/null)" = healthy ] \
		&& [ "$$(docker inspect -f '{{.State.Health.Status}}' search-rabbitmq 2>/dev/null)" = healthy ] \
		&& [ "$$(docker inspect -f '{{.State.Health.Status}}' search-opensearch 2>/dev/null)" = healthy ]; do sleep 2; done
	@echo "Infra lista: postgres :5434 | rabbitmq :5672 (UI :15672) | opensearch :9200"

tools: ## Levanta OpenSearch Dashboards (:5601)
	docker compose --profile tools up -d dashboards

down: ## Para los contenedores
	docker compose down

logs: ## Logs de la infra
	docker compose logs -f

reset: ## Borra contenedores y volúmenes (datos incluidos)
	docker compose down -v

db-migrate: ## Aplica las migraciones de Prisma
	cd backend && npx prisma migrate dev

db-seed: ## Crea el usuario demo
	cd backend && npm run db:seed

os-init: ## Crea el índice de productos en OpenSearch
	cd backend && npm run os:init

dev: ## Arranca API + worker + frontend
	cd backend && npm run dev & \
	cd backend && npm run dev:worker & \
	cd frontend && npm run dev & \
	wait

dev-api: ## Solo la API
	cd backend && npm run dev

dev-worker: ## Solo el worker
	cd backend && npm run dev:worker

dev-web: ## Solo el frontend
	cd frontend && npm run dev

test: ## Tests de backend y frontend
	cd backend && npm test
	cd frontend && npm test

lint: ## Typecheck + lint
	cd backend && npm run typecheck
	cd frontend && npm run lint

build: ## Build de producción
	cd backend && npm run build
	cd frontend && npm run build
