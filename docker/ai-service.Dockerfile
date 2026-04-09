FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

COPY service.py ./
COPY prompts/ ./prompts/
COPY utils/ ./utils/

EXPOSE 5002

CMD ["python", "service.py"]
