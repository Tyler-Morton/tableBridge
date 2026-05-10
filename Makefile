.PHONY: dev backend frontend install seed test fmt lint clean

# One-command local dev (no Docker)
dev:
	@echo "Starting backend + frontend in parallel..."
	@(cd backend && python -m uvicorn app.main:app --reload --port 8000) & \
	(cd frontend && npm run dev) ; \
	wait

backend:
	cd backend && python -m uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

install:
	cd backend && pip install -e ".[dev]"
	cd frontend && npm install

seed:
	cd backend && python seed_data.py

test:
	cd backend && pytest
	cd frontend && npm run test

fmt:
	cd backend && ruff format . && ruff check --fix .
	cd frontend && npm run format

lint:
	cd backend && ruff check . && mypy app
	cd frontend && npm run lint

clean:
	rm -rf backend/data/*.db
	rm -rf backend/.pytest_cache backend/.mypy_cache backend/.ruff_cache
	rm -rf frontend/node_modules frontend/dist
