const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'enterprise-marketplace',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: {
    retries: 2,
    initialRetryTime: 300,
  },
});

const producer = kafka.producer();

const connectKafkaProducer = async () => {
  if (!process.env.KAFKA_BROKER) return;
  try {
    await producer.connect();
    console.log('Kafka Producer connected');
  } catch (err) {
    console.warn('Kafka Producer warning:', err.message);
  }
};

const publishEvent = async (topic, key, message) => {
  if (!process.env.KAFKA_BROKER) return;
  try {
    await producer.send({
      topic,
      messages: [
        { key: String(key), value: JSON.stringify(message) }
      ],
    });
  } catch (err) {
    console.warn(`Failed to publish event to topic ${topic}:`, err.message);
  }
};

module.exports = {
  kafka,
  producer,
  connectKafkaProducer,
  publishEvent
};
