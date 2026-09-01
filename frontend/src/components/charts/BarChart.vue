<template>
  <div ref="chartRef" class="chart-container" :style="{ height: height + 'px' }"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'

interface DataItem {
  name: string
  success: number
  failed: number
}

const props = withDefaults(
  defineProps<{
    data: DataItem[]
    height?: number
  }>(),
  {
    height: 300
  }
)

const chartRef = ref<HTMLElement>()
let chart: echarts.ECharts | null = null

const initChart = () => {
  if (!chartRef.value) return

  chart = echarts.init(chartRef.value)

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    legend: {
      data: ['成功', '失败'],
      bottom: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: props.data.length > 5 ? '18%' : '12%',
      top: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: props.data.map((d) => d.name),
      axisLabel: {
        interval: 0,
        rotate: props.data.length > 4 ? 30 : 0,
        formatter: function (value: string) {
          return value.length > 6 ? value.substring(0, 6) + '...' : value
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '用例数'
    },
    series: [
      {
        name: '成功',
        type: 'bar',
        stack: 'total',
        data: props.data.map((d) => d.success),
        itemStyle: {
          color: '#67c23a'
        }
      },
      {
        name: '失败',
        type: 'bar',
        stack: 'total',
        data: props.data.map((d) => d.failed),
        itemStyle: {
          color: '#f56c6c'
        }
      }
    ]
  }

  chart.setOption(option)
}

const resizeChart = () => {
  chart?.resize()
}

watch(
  () => props.data,
  () => {
    initChart()
  },
  { deep: true }
)

onMounted(() => {
  initChart()
  window.addEventListener('resize', resizeChart)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeChart)
  chart?.dispose()
})

onUnmounted(() => {
  chart?.dispose()
})
</script>

<style scoped>
.chart-container {
  width: 100%;
}
</style>
