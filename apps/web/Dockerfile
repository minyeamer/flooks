FROM node:20-alpine

WORKDIR /workspace

COPY package.json package-lock.json tsconfig.base.json /workspace/
COPY apps/web/package.json /workspace/apps/web/package.json
COPY packages/dashboard-schema/package.json /workspace/packages/dashboard-schema/package.json

RUN npm install

COPY apps/web /workspace/apps/web
COPY packages/dashboard-schema /workspace/packages/dashboard-schema

WORKDIR /workspace/apps/web

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
