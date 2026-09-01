FROM openjdk:11.0.11-jre-slim

WORKDIR /app
EXPOSE 8080
COPY target/gateway-service-*.jar app.jar
COPY skywalking-agent/ /app/skywalking-agent/
RUN cp /app/skywalking-agent/optional-plugins/apm-spring-cloud-gateway-3.x-plugin-*.jar /app/skywalking-agent/plugins/

ENV JAVA_OPTS="-javaagent:/app/skywalking-agent/skywalking-agent.jar"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
