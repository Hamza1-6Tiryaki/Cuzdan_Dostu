"""routers/__init__.py"""
from .auth     import router as auth_router
from .products import router as products_router
from .budget   import router as budget_router
from .admin    import router as admin_router

__all__ = ["auth_router", "products_router", "budget_router", "admin_router"]
