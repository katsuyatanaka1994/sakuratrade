import pytest


@pytest.fixture
def anyio_backend():
    """Force AnyIO tests to run with the asyncio backend during CI runs."""
    return "asyncio"
