FROM mhart/alpine-node:4.2.1

RUN apk add --update make gcc g++ python

ENV NODE_ENV=production

WORKDIR /src
ADD . .

RUN npm install --production && \
    npm cache clean && \
    apk del make gcc g++ python && \
    rm -rf /tmp/* /var/cache/apk/* /root/.npm /root/.node-gyp

VOLUME ["/src/conf"]
EXPOSE 9000
CMD ["node", "app.js"]
