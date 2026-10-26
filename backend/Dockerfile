FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM alpine:3.22
RUN adduser -D -H appuser
USER appuser
COPY --from=build /out/server /server
EXPOSE 8080
ENTRYPOINT ["/server"]
