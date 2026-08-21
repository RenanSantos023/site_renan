.PHONY: install test test-unit test-integration lint clean

VENV = .venv
PYTHON = $(VENV)/bin/python
PIP = $(VENV)/bin/pip
PYTEST = $(VENV)/bin/pytest

install:
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt

test:
	PYTHONPATH=. $(PYTEST) -v tests/

test-unit:
	PYTHONPATH=. $(PYTEST) -v tests/unit/

test-integration:
	PYTHONPATH=. $(PYTEST) -v tests/integration/

lint:
	$(PYTHON) -m py_compile src/**/*.py tests/**/*.py

clean:
	rm -rf __pycache__ .pytest_cache .coverage
	find . -type d -name "__pycache__" -exec rm -rf {} +
