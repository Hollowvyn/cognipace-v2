FROM python:3.12-slim

# no .pyc, and unbuffered so Railway's log stream shows crashes
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends gcc \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY agent.py .

# bake any plugin model weights into the image instead of downloading
# them on every cold start. The script-level `python agent.py download-files`
# form was deprecated in livekit-agents 1.5.10; the module form works on 1.7+.
RUN python -m livekit.agents download-files

# workers dial out over websocket, so nothing needs to be exposed.
# 8081 is the optional health endpoint if you want Railway to probe it.
EXPOSE 8081

ENTRYPOINT ["python", "agent.py"]
CMD ["start"]
