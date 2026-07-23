#!/bin/bash
cd "$(dirname "$0")/server"
DOTENV_PATH="$(dirname "$0")/.env.babel" npm start
