FROM openjdk:11.0.11-jre-slim

WORKDIR /app

COPY target/platform-service-*.jar app.jar

COPY skywalking-agent/ /app/skywalking-agent/

ENV JAVA_OPTS="-javaagent:/app/skywalking-agent/skywalking-agent.jar"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
