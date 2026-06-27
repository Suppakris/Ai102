from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import convert

app = FastAPI(title='PDF to Slides API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(convert.router, prefix='/api')

@app.get('/')
def root():
    return {'status': 'running'}
