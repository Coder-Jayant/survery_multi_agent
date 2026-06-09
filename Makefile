# MiniSense — Makefile (Phase 2)
# One-command setup and demo

.PHONY: install data ingest test demo api ui build clean

install:
	pip install -r requirements.txt

data:
	python -X utf8 data/generate_data.py

ingest:
	python -X utf8 rag/ingest.py

setup: install data ingest
	@echo ""
	@echo "[OK] MiniSense is ready. Run: make demo"

test:
	python -X utf8 test_imports.py

demo:
	python -X utf8 cli.py --question "What are the top 3 complaints in May 2026 and how do they compare to April?" --verbose

demo-csat:
	python -X utf8 cli.py --question "What is the current CSAT score and are we meeting our target?" --verbose

demo-all:
	python -X utf8 cli.py --demo

eval:
	python -X utf8 evaluation/rag_eval.py

api:
	uvicorn api.main:app --reload

ui:
	cd frontend && npm run dev

build:
	cd frontend && npm run build

phase2: install data ingest build
	@echo ""
	@echo "[OK] MiniSense Phase 2 is ready."
	@echo "     Run: make api"
	@echo "     Open: http://localhost:8000"

clean:
	rm -f data/survey_responses.json
	rm -rf rag/vector_store/
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
