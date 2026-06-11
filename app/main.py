from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app import models

from app.routers import auth
from app.routers import users
from app.routers import roles
from app.routers import resources
from app.routers import access
from app.routers import audit
from app.routers import departments
from app.routers import dashboard
from app.routers import health
from app.routers import system
from app.routers import cross_department
from app.routers import my_resources



Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="Hybrid RMAC Access Control System",
    description="API for combined RMAC access control model with department hierarchy.",
    version="1.0.0"
)


origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(roles.router)
app.include_router(resources.router)
app.include_router(access.router)
app.include_router(audit.router)
app.include_router(departments.router)
app.include_router(dashboard.router)
app.include_router(health.router)
app.include_router(system.router)
app.include_router(cross_department.router)  
app.include_router(my_resources.router)

@app.get("/")
def root():
    return {
        "message": "Hybrid RMAC Access Control API is running"
    }