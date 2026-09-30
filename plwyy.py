import subprocess
from functools import partial

from lxml import etree

subprocess.Popen = partial(subprocess.Popen, encoding='utf-8')
import requests
# import random
# import string
import execjs
import time

# url ='https://music.163.com/discover/toplist?id=3778678'
# headers = {
#     'Referer':'https://music.163.com/',
#     'Sec-Fetch-Dest':'iframe',
#     'Sec-Fetch-Mode':'navigate',
#     'Sec-Fetch-Site':'same-origin',
#     'Upgrade-Insecure-Requests':'1',
#     'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
# }
# html = requests.get(url, headers=headers)
# with open('html.html','w',encoding='utf-8') as f:
#     f.write(html.text)
# with open('html.html','r',encoding='utf-8') as f:
#     html = f.read()
# tree = etree.HTML(html)
# li_lst = tree.xpath('//ul[@class="f-hide
# print(id)

def get_id():
    url = 'https://music.163.com/discover/toplist?id=3778678'
    headers = {
        'Referer':'https://music.163.com/',
        'Sec-Fetch-Dest':'iframe',
        'Sec-Fetch-Mode':'navigate',
        'Sec-Fetch-Site':'same-origin',
        'Upgrade-Insecure-Requests':'1',
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
    song_lst = []

    html = requests.get(url, headers=headers)
    with open('html.html', 'w', encoding='utf-8') as f:
        f.write(html.text)
        with open('html.html', 'r', encoding='utf-8') as f:
            html = f.read()
            tree = etree.HTML(html)
            li_lst = tree.xpath('//ul[@class="f-hide"]/li')
            for li in li_lst:
                id_dic = {}
                href = li.xpath('./a/@href')[0]
                song = li.xpath('./a/text()')[0]
                id = href.split('=')[-1]
                id_dic['id'] = id
                id_dic['song'] = song
                song_lst.append(id_dic)
    return song_lst

for i in get_id()[:11]:
    id = i['id']
    song = i['song']
    with open('wyyy.js', 'r', encoding='utf-8') as f:
        js_code = f.read()
    js = execjs.compile(js_code)
    res = js.call('getParam', id)

    url = 'https://music.163.com/weapi/song/enhance/player/url/v1?csrf_token='
    headers = {
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Cache-Control': 'no-cache',
        'Content-Length': '438',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Pragma': 'no-cache',
        'Referer': 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    data = {
        'params': res['encText'],
        'encSecKey': res['encSecKey']
    }
    song_url = requests.post(url, headers=headers, data=data).json()['data'][0]['url']
    headers = {
        "Accept": "*/*",
        "Accept-Encoding": "identity;q=1, *;q=0",
        "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Referer": "https://music.163.com/",
        "Sec-Ch-Ua": "\"Chromium\";v=\"116\", \"Not)A;Brand\";v=\"24\", \"Google Chrome\";v=\"116\"",
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": "\"Windows\"",
        "Sec-Fetch-Dest": "audio",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "cross-site",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
    }
    response = requests.get(song_url, headers=headers)
    with open(f'./test/{song}.mp3', 'wb') as f:
        f.write(response.content)
    time.sleep(0.5)