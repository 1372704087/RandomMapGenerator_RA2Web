0058D620  push    ebp
0058D621  mov     ebp, esp
0058D623  and     esp, 0FFFFFFF8h
0058D626  sub     esp, 0A0h
0058D62C  push    ebx
0058D62D  mov     ebx, ecx
0058D62F  push    ebp
0058D630  push    esi
0058D631  mov     al, [ebx+1Ah]
0058D634  push    edi
0058D635  xor     edi, edi
0058D637  mov     [esp+0B0h+var_60], ebx
0058D63B  test    al, al
0058D63D  jz      short loc_58D649
0058D63F  xor     al, al
0058D641  pop     edi
0058D642  pop     esi
0058D643  pop     ebp
0058D644  pop     ebx
0058D645  mov     esp, ebp
0058D647  pop     ebp
0058D648  retn
0058D649  mov     eax, [ebx+0Ch]
0058D64C  lea     esi, [eax+eax+0Ah]
0058D650  lea     ecx, ds:0[esi*8]
0058D657  push    ecx; Size
0058D658  call    ??2@YAPAXI@Z; operator new(uint)
0058D65D  add     esp, 4
0058D660  cmp     eax, edi
0058D662  jz      short loc_58D66F
0058D664  dec     esi
0058D665  mov     [esp+0B0h+Block], eax
0058D669  mov     dword ptr [esp+0B0h+var_58], esi
0058D66D  jmp     short loc_58D673
0058D66F  mov     [esp+0B0h+Block], edi
0058D673  push    14h; Size
0058D675  call    ??2@YAPAXI@Z; operator new(uint)
0058D67A  mov     esi, eax
0058D67C  add     esp, 4
0058D67F  or      ebp, 0FFFFFFFFh
0058D682  cmp     esi, edi
0058D684  jz      short loc_58D6C5
0058D686  mov     edx, [ebx+0Ch]
0058D689  mov     [esi+0Ch], edi
0058D68C  mov     [esi+10h], ebp
0058D68F  mov     [esi], edi
0058D691  lea     eax, [edx+edx+0Ah]
0058D695  mov     [esi+4], eax
0058D698  lea     eax, ds:4[eax*4]
0058D69F  push    eax; Size
0058D6A0  call    ??2@YAPAXI@Z; operator new(uint)
0058D6A5  mov     ecx, [esi+4]
0058D6A8  mov     [esi+8], eax
0058D6AB  add     esp, 4
0058D6AE  xor     eax, eax
0058D6B0  cmp     ecx, edi
0058D6B2  jl      short loc_58D6C7
0058D6B4  mov     ecx, [esi+8]
0058D6B7  inc     eax
0058D6B8  mov     [ecx+eax*4-4], edi
0058D6BC  mov     ecx, [esi+4]
0058D6BF  cmp     eax, ecx
0058D6C1  jle     short loc_58D6B4
0058D6C3  jmp     short loc_58D6C7
0058D6C5  xor     esi, esi
0058D6C7  mov     ecx, [esi]
0058D6C9  xor     eax, eax
0058D6CB  cmp     ecx, edi
0058D6CD  jl      short loc_58D6DD
0058D6CF  mov     edx, [esi+8]
0058D6D2  inc     eax
0058D6D3  mov     [edx+eax*4-4], edi
0058D6D7  mov     ecx, [esi]
0058D6D9  cmp     eax, ecx
0058D6DB  jle     short loc_58D6CF
0058D6DD  mov     [esi], edi
0058D6DF  mov     eax, dword_89C2DC
0058D6E4  imul    eax, eax
0058D6E7  cmp     eax, edi
0058D6E9  jle     short loc_58D6FD
0058D6EB  xor     ecx, ecx
0058D6ED  mov     edx, dword_ABED10
0058D6F3  add     ecx, 50h ; 'P'
0058D6F6  dec     eax
0058D6F7  mov     [ecx+edx-14h], ebp
0058D6FB  jnz     short loc_58D6ED
0058D6FD  mov     ecx, [ebx+38h]
0058D700  mov     [esp+0B0h+var_70], edi
0058D704  dec     ecx
0058D705  js      short loc_58D739
0058D707  mov     eax, [esp+0B0h+var_60]
0058D70B  mov     edx, [eax+2Ch]
0058D70E  movsx   eax, word ptr [edx+ecx*4+2]
0058D713  imul    eax, dword_89C2DC
0058D71A  lea     edx, [edx+ecx*4]
0058D71D  movsx   edx, word ptr [edx]
0058D720  add     eax, edx
0058D722  mov     edx, dword_ABED10
0058D728  lea     eax, [eax+eax*4]
0058D72B  shl     eax, 4
0058D72E  dec     ecx
0058D72F  mov     dword ptr [eax+edx+38h], 0FFFFFFFEh
0058D737  jns     short loc_58D707
0058D739  mov     ebp, [esp+0B0h+var_60]
0058D73D  mov     eax, 55555556h
0058D742  mov     ecx, [ebp+0Ch]
0058D745  imul    ecx
0058D747  mov     eax, edx
0058D749  shr     eax, 1Fh
0058D74C  add     edx, eax
0058D74E  mov     eax, ecx
0058D750  mov     edi, edx
0058D752  cdq
0058D753  and     edx, 7
0058D756  mov     ecx, edi
0058D758  add     eax, edx
0058D75A  sar     eax, 3
0058D75D  sub     ecx, eax
0058D75F  inc     ecx
0058D760  xor     ebx, ebx
0058D762  mov     dword ptr [esp+0B0h+var_80], ecx
0058D766  mov     dword ptr [esp+0B0h+var_80+4], ebx
0058D76A  fild    [esp+0B0h+var_80]
0058D76E  mov     dword ptr [esp+0B0h+var_80], eax
0058D772  mov     dword ptr [esp+0B0h+var_80+4], ebx
0058D776  fstp    [esp+0B0h+var_48]
0058D77A  fild    [esp+0B0h+var_80]
0058D77E  fstp    [esp+0B0h+var_58]
0058D782  mov     ecx, offset unk_ABE890
0058D787  call    sub_65C780
0058D78C  mov     dword ptr [esp+0B0h+var_80], eax
0058D790  mov     dword ptr [esp+0B0h+var_80+4], ebx
0058D794  fild    [esp+0B0h+var_80]
0058D798  fmul    [esp+0B0h+var_48]
0058D79C  fmul    ds:dbl_7ED898
0058D7A2  fadd    [esp+0B0h+var_58]
0058D7A6  call    sub_7C5F00
0058D7AB  cmp     eax, edi
0058D7AD  mov     [esp+0B0h+var_1C], eax
0058D7B4  ja      short loc_58D782
0058D7B6  mov     edi, [ebp+38h]
0058D7B9  mov     dword ptr [esp+0B0h+var_80+4], ebx
0058D7BD  dec     edi
0058D7BE  lea     edx, [edi+1]
0058D7C1  mov     dword ptr [esp+0B0h+var_80], edx
0058D7C5  fild    [esp+0B0h+var_80]
0058D7C9  fstp    [esp+0B0h+var_48]
0058D7CD  mov     ecx, offset unk_ABE890
0058D7D2  call    sub_65C780
0058D7D7  mov     dword ptr [esp+0B0h+var_80], eax
0058D7DB  mov     dword ptr [esp+0B0h+var_80+4], ebx
0058D7DF  fild    [esp+0B0h+var_80]
0058D7E3  fmul    [esp+0B0h+var_48]
0058D7E7  fmul    ds:dbl_7ED898
0058D7ED  call    sub_7C5F00
0058D7F2  cmp     eax, edi
0058D7F4  ja      short loc_58D7CD
0058D7F6  mov     ecx, [ebp+2Ch]
0058D7F9  mov     edi, [esp+0B0h+Block]
0058D7FD  mov     [esp+0B0h+var_5C], 1
0058D805  mov     eax, [ecx+eax*4]
0058D808  mov     [esp+0B0h+var_4C], eax
0058D80C  mov     [edi], eax
0058D80E  mov     [edi+4], ebx
0058D811  mov     ecx, dword_ABED10
0058D817  movsx   eax, word ptr [esp+0B0h+var_4C+2]
0058D81C  imul    eax, dword_89C2DC
0058D823  movsx   edx, word ptr [esp+0B0h+var_4C]
0058D828  add     eax, edx
0058D82A  lea     eax, [eax+eax*4]
0058D82D  shl     eax, 4
0058D830  mov     dword ptr [eax+ecx+3Ch], 0FFFFFFFDh
0058D838  mov     ecx, [esi]
0058D83A  mov     eax, [edi+4]
0058D83D  inc     ecx
0058D83E  mov     edx, ecx
0058D840  mov     [esp+0B0h+var_6C], eax
0058D844  mov     eax, [esi+4]
0058D847  shr     edx, 1
0058D849  cmp     ecx, eax
0058D84B  jnb     short loc_58D891
0058D84D  cmp     ecx, 1
0058D850  jbe     short loc_58D874
0058D852  mov     ebx, [esi+8]
0058D855  mov     ebp, [ebx+edx*4]
0058D858  fld     dword ptr [ebp+4]
0058D85B  fcomp   [esp+0B0h+var_6C]
0058D85F  fnstsw  ax
0058D861  test    ah, 41h
0058D864  jnz     short loc_58D872
0058D866  mov     [ebx+ecx*4], ebp
0058D869  mov     ecx, edx
0058D86B  shr     edx, 1
0058D86D  cmp     ecx, 1
0058D870  ja      short loc_58D852
0058D872  xor     ebx, ebx
0058D874  mov     edx, [esi+8]
0058D877  mov     [edx+ecx*4], edi
0058D87A  mov     ecx, [esi]
0058D87C  mov     eax, [esi+0Ch]
0058D87F  inc     ecx
0058D880  cmp     edi, eax
0058D882  mov     [esi], ecx
0058D884  jbe     short loc_58D889
0058D886  mov     [esi+0Ch], edi
0058D889  cmp     edi, [esi+10h]
0058D88C  jnb     short loc_58D891
0058D88E  mov     [esi+10h], edi
0058D891  mov     ecx, [esi]
0058D893  cmp     ecx, ebx
0058D895  jnz     short loc_58D89B
0058D897  xor     edi, edi
0058D899  jmp     short loc_58D8BD
0058D89B  mov     eax, [esi+8]
0058D89E  push    1
0058D8A0  mov     ecx, [eax+ecx*4]
0058D8A3  mov     edi, [eax+4]
0058D8A6  mov     [eax+4], ecx
0058D8A9  mov     edx, [esi]
0058D8AB  mov     eax, [esi+8]
0058D8AE  mov     [eax+edx*4], ebx
0058D8B1  mov     ecx, [esi]
0058D8B3  dec     ecx
0058D8B4  mov     [esi], ecx
0058D8B6  mov     ecx, esi
0058D8B8  call    sub_5AD870
0058D8BD  mov     ecx, offset unk_ABE890
0058D8C2  mov     [esp+0B0h+var_84], edi
0058D8C6  call    sub_65C780
0058D8CB  mov     dword ptr [esp+0B0h+var_80], eax
0058D8CF  mov     dword ptr [esp+0B0h+var_80+4], ebx
0058D8D3  fild    [esp+0B0h+var_80]
0058D8D7  cmp     edi, ebx
0058D8D9  fmul    ds:dbl_7ED8A8
0058D8DF  fstp    [esp+0B0h+var_80]
0058D8E3  jz      loc_58DB3B
0058D8E9  mov     ecx, [esp+0B0h+var_1C]
0058D8F0  mov     eax, [esp+0B0h+var_70]
0058D8F4  cmp     eax, ecx
0058D8F6  jge     loc_58DB3B
0058D8FC  mov     edx, dword_ABED10
0058D902  mov     ecx, [esp+0B0h+var_84]
0058D906  test    edx, edx
0058D908  jz      short loc_58D928
0058D90A  movsx   eax, word ptr [ecx+2]
0058D90E  imul    eax, dword_89C2DC
0058D915  movsx   edi, word ptr [ecx]
0058D918  add     eax, edi
0058D91A  lea     eax, [eax+eax*4]
0058D91D  shl     eax, 4
0058D920  mov     dword ptr [eax+edx+38h], 0FFFFFFFDh
0058D928  movsx   eax, word ptr [ecx+2]
0058D92C  imul    eax, dword_89C2DC
0058D933  movsx   edx, word ptr [ecx]
0058D936  add     eax, edx
0058D938  mov     edx, [esp+0B0h+var_5C]
0058D93C  mov     dword ptr [esp+0B0h+var_68], eax
0058D940  mov     eax, [esp+0B0h+Block]
0058D944  mov     [esp+0B0h+var_A0], 0
0058D94C  mov     [esp+0B0h+var_6C], offset dword_89A304
0058D954  lea     ebp, [eax+edx*8]
0058D957  jmp     short loc_58D95D
0058D959  mov     ecx, [esp+0B0h+var_84]
0058D95D  mov     eax, [esp+0B0h+var_A0]
0058D961  and     eax, 7
0058D964  lea     edx, ds:89F688h[eax*4]
0058D96B  lea     eax, [esp+0B0h+var_48]
0058D96F  push    edx
0058D970  push    eax
0058D971  call    sub_42D510
0058D976  mov     eax, [eax]
0058D978  mov     edi, dword_ABED04
0058D97E  mov     dword ptr [esp+0B0h+var_3C], eax
0058D982  mov     [esp+0B0h+var_50], eax
0058D986  movsx   ecx, ax
0058D989  movsx   eax, word ptr [esp+0B0h+var_3C+2]
0058D98E  lea     edx, [eax+ecx]
0058D991  cmp     edx, edi
0058D993  jle     loc_58DAC1
0058D999  mov     ebx, ecx
0058D99B  sub     ebx, eax
0058D99D  cmp     ebx, edi
0058D99F  jge     loc_58DAC1
0058D9A5  mov     ebx, eax
0058D9A7  sub     ebx, ecx
0058D9A9  cmp     ebx, edi
0058D9AB  jge     loc_58DAC1
0058D9B1  cmp     edx, dword_ABED08
0058D9B7  jg      loc_58DAC1
0058D9BD  mov     edx, dword_ABED10
0058D9C3  test    edx, edx
0058D9C5  jz      loc_58DAC1
0058D9CB  imul    eax, dword_89C2DC
0058D9D2  add     eax, ecx
0058D9D4  lea     ecx, [eax+eax*4]
0058D9D7  shl     ecx, 4
0058D9DA  lea     eax, [ecx+edx]
0058D9DD  mov     ecx, [ecx+edx+38h]
0058D9E1  cmp     ecx, 0FFFFFFFEh
0058D9E4  jnz     loc_58DAC1
0058D9EA  cmp     dword ptr [eax+3Ch], 0FFFFFFFDh
0058D9EE  jz      loc_58DAC1
0058D9F4  lea     edx, [esp+0B0h+var_50]
0058D9F8  mov     ecx, offset stru_87F7E8
0058D9FD  push    edx
0058D9FE  call    sub_5657A0
0058DA03  mov     ecx, eax
0058DA05  call    sub_486380
0058DA0A  test    al, al
0058DA0C  jz      loc_58DAC1
0058DA12  mov     eax, [esp+0B0h+var_50]
0058DA16  mov     ecx, dword ptr [esp+0B0h+var_80+4]
0058DA1A  mov     edx, dword ptr [esp+0B0h+var_80]
0058DA1E  mov     [ebp+0], eax
0058DA21  push    ecx
0058DA22  lea     eax, [esp+0B4h+var_50]
0058DA26  push    edx; double
0058DA27  lea     ecx, [esp+0B8h+var_4C]
0058DA2B  push    eax; int
0058DA2C  push    ecx; int
0058DA2D  mov     ecx, [esp+0C0h+var_60]
0058DA31  call    sub_58C6F0
0058DA36  mov     edx, [esp+0B0h+var_6C]
0058DA3A  mov     eax, dword ptr [esp+0B0h+var_68]
0058DA3E  fstp    dword ptr [ebp+4]
0058DA41  mov     ebx, [edx]
0058DA43  mov     ecx, dword_ABED10
0058DA49  add     eax, ebx
0058DA4B  mov     edx, [esp+0B0h+var_5C]
0058DA4F  mov     edi, ebp
0058DA51  add     ebp, 8
0058DA54  lea     eax, [eax+eax*4]
0058DA57  shl     eax, 4
0058DA5A  inc     edx
0058DA5B  mov     dword ptr [eax+ecx+3Ch], 0FFFFFFFDh
0058DA63  mov     ecx, [esi]
0058DA65  mov     eax, [edi+4]
0058DA68  inc     ecx
0058DA69  mov     [esp+0B0h+var_5C], edx
0058DA6D  mov     edx, ecx
0058DA6F  mov     dword ptr [esp+0B0h+var_58], eax
0058DA73  mov     eax, [esi+4]
0058DA76  shr     edx, 1
0058DA78  cmp     ecx, eax
0058DA7A  jnb     short loc_58DAC1
0058DA7C  cmp     ecx, 1
0058DA7F  jbe     short loc_58DAA4
0058DA81  mov     ebx, [esi+8]
0058DA84  mov     eax, [ebx+edx*4]
0058DA87  fld     dword ptr [eax+4]
0058DA8A  fcomp   dword ptr [esp+0B0h+var_58]
0058DA8E  fnstsw  ax
0058DA90  test    ah, 41h
0058DA93  jnz     short loc_58DAA4
0058DA95  mov     eax, [ebx+edx*4]
0058DA98  mov     [ebx+ecx*4], eax
0058DA9B  mov     ecx, edx
0058DA9D  shr     edx, 1
0058DA9F  cmp     ecx, 1
0058DAA2  ja      short loc_58DA81
0058DAA4  mov     edx, [esi+8]
0058DAA7  mov     [edx+ecx*4], edi
0058DAAA  mov     ecx, [esi]
0058DAAC  mov     eax, [esi+0Ch]
0058DAAF  inc     ecx
0058DAB0  cmp     edi, eax
0058DAB2  mov     [esi], ecx
0058DAB4  jbe     short loc_58DAB9
0058DAB6  mov     [esi+0Ch], edi
0058DAB9  cmp     edi, [esi+10h]
0058DABC  jnb     short loc_58DAC1
0058DABE  mov     [esi+10h], edi
0058DAC1  mov     eax, [esp+0B0h+var_6C]
0058DAC5  mov     edi, [esp+0B0h+var_A0]
0058DAC9  add     eax, 8
0058DACC  add     edi, 2
0058DACF  cmp     eax, offset unk_89A324
0058DAD4  mov     [esp+0B0h+var_A0], edi
0058DAD8  mov     [esp+0B0h+var_6C], eax
0058DADC  jl      loc_58D959
0058DAE2  mov     ecx, [esp+0B0h+var_70]
0058DAE6  inc     ecx
0058DAE7  mov     [esp+0B0h+var_70], ecx
0058DAEB  mov     ecx, offset byte_ABDFB8
0058DAF0  call    sub_5980C0
0058DAF5  fmul    ds:dbl_7ED8A0
0058DAFB  mov     ecx, [esi]
0058DAFD  test    ecx, ecx
0058DAFF  fadd    [esp+0B0h+var_80]
0058DB03  fstp    [esp+0B0h+var_80]
0058DB07  jz      short loc_58DB3B
0058DB09  mov     eax, [esi+8]
0058DB0C  push    1
0058DB0E  mov     ecx, [eax+ecx*4]
0058DB11  mov     edi, [eax+4]
0058DB14  mov     [eax+4], ecx
0058DB17  mov     edx, [esi]
0058DB19  mov     eax, [esi+8]
0058DB1C  mov     ecx, esi
0058DB1E  mov     dword ptr [eax+edx*4], 0
0058DB25  mov     edx, [esi]
0058DB27  dec     edx
0058DB28  mov     [esi], edx
0058DB2A  call    sub_5AD870
0058DB2F  test    edi, edi
0058DB31  mov     [esp+0B0h+var_84], edi
0058DB35  jnz     loc_58D8E9
0058DB3B  mov     ecx, dword_89C2DC
0058DB41  imul    ecx, ecx
0058DB44  test    ecx, ecx
0058DB46  jle     short loc_58DB5D
0058DB48  xor     eax, eax
0058DB4A  or      edx, 0FFFFFFFFh
0058DB4D  mov     edi, dword_ABED10
0058DB53  add     eax, 50h ; 'P'
0058DB56  dec     ecx
0058DB57  mov     [eax+edi-14h], edx
0058DB5B  jnz     short loc_58DB4D
0058DB5D  mov     ecx, [esi]
0058DB5F  test    ecx, ecx
0058DB61  jnz     short loc_58DB67
0058DB63  xor     edi, edi
0058DB65  jmp     short loc_58DB8D
0058DB67  mov     eax, [esi+8]
0058DB6A  push    1
0058DB6C  mov     ecx, [eax+ecx*4]
0058DB6F  mov     edi, [eax+4]
0058DB72  mov     [eax+4], ecx
0058DB75  mov     edx, [esi]
0058DB77  mov     eax, [esi+8]
0058DB7A  mov     dword ptr [eax+edx*4], 0
0058DB81  mov     ecx, [esi]
0058DB83  dec     ecx
0058DB84  mov     [esi], ecx
0058DB86  mov     ecx, esi
0058DB88  call    sub_5AD870
0058DB8D  push    0
0058DB8F  push    0
0058DB91  lea     ecx, [esp+0B8h+var_18]
0058DB98  call    sub_42FCB0
0058DB9D  mov     ebp, 0Ah
0058DBA2  mov     [esp+0B0h+var_18], offset ??_7?$DynamicVectorClass@VCell@@@@6B@; const DynamicVectorClass<Cell>::`vftable'
0058DBAD  test    edi, edi
0058DBAF  mov     [esp+0B0h+var_4], ebp
0058DBB6  mov     [esp+0B0h+var_8], 0
0058DBC1  jz      short loc_58DC1E
0058DBC3  mov     ebx, 0FFFFFFFDh
0058DBC8  mov     edi, [edi]
0058DBCA  mov     dword ptr [esp+0B0h+var_58], edi
0058DBCE  movsx   eax, word ptr [esp+0B0h+var_58+2]
0058DBD3  imul    eax, dword_89C2DC
0058DBDA  movsx   ecx, di
0058DBDD  add     eax, ecx
0058DBDF  lea     edx, [eax+eax*4]
0058DBE2  mov     eax, dword_ABED10
0058DBE7  shl     edx, 4
0058DBEA  mov     [edx+eax+38h], ebx
0058DBEE  mov     ecx, [esi]
0058DBF0  test    ecx, ecx
0058DBF2  jz      short loc_58DC1E
0058DBF4  mov     eax, [esi+8]
0058DBF7  push    1
0058DBF9  mov     ecx, [eax+ecx*4]
0058DBFC  mov     edi, [eax+4]
0058DBFF  mov     [eax+4], ecx
0058DC02  mov     edx, [esi]
0058DC04  mov     eax, [esi+8]
0058DC07  mov     ecx, esi
0058DC09  mov     dword ptr [eax+edx*4], 0
0058DC10  mov     edx, [esi]
0058DC12  dec     edx
0058DC13  mov     [esi], edx
0058DC15  call    sub_5AD870
0058DC1A  test    edi, edi
0058DC1C  jnz     short loc_58DBC8
0058DC1E  mov     ecx, [esp+0B0h+Block]
0058DC22  push    ecx; Block
0058DC23  call    ??3@YAXPAX@Z; operator delete(void *)
0058DC28  add     esp, 4
0058DC2B  test    esi, esi
0058DC2D  jz      short loc_58DC41
0058DC2F  mov     edx, [esi+8]
0058DC32  push    edx; Block
0058DC33  call    ??3@YAXPAX@Z; operator delete(void *)
0058DC38  push    esi; Block
0058DC39  call    ??3@YAXPAX@Z; operator delete(void *)
0058DC3E  add     esp, 8
0058DC41  push    0
0058DC43  push    0
0058DC45  lea     ecx, [esp+0B8h+var_34]
0058DC4C  call    sub_5AD740
0058DC51  mov     ebx, [esp+0B0h+var_60]
0058DC55  mov     [esp+0B0h+var_34], offset off_7ED858
0058DC5D  mov     [esp+0B0h+var_20], ebp
0058DC64  mov     [esp+0B0h+var_24], 0
0058DC6F  mov     edx, [ebx+38h]
0058DC72  dec     edx
0058DC73  mov     [esp+0B0h+var_84], edx
0058DC77  js      loc_58DF85
0058DC7D  mov     ecx, dword_ABED10
0058DC83  mov     eax, [ebx+2Ch]
0058DC86  mov     ebp, [eax+edx*4]
0058DC89  mov     dword ptr [esp+0B0h+var_58], ebp
0058DC8D  movsx   eax, word ptr [esp+0B0h+var_58+2]
0058DC92  imul    eax, dword_89C2DC
0058DC99  movsx   esi, bp
0058DC9C  add     eax, esi
0058DC9E  lea     esi, [eax+eax*4]
0058DCA1  shl     esi, 4
0058DCA4  mov     eax, [esi+ecx+38h]
0058DCA8  cmp     eax, 0FFFFFFFFh
0058DCAB  jge     loc_58DF7A
0058DCB1  mov     ecx, eax
0058DCB3  push    50h ; 'P'; Size
0058DCB5  mov     dword ptr [esp+0B4h+var_3C], ecx
0058DCB9  call    ??2@YAPAXI@Z; operator new(uint)
0058DCBE  add     esp, 4
0058DCC1  test    eax, eax
0058DCC3  jz      short loc_58DCD1
0058DCC5  push    ebp
0058DCC6  mov     ecx, eax
0058DCC8  call    sub_58BF70
0058DCCD  mov     ebx, eax
0058DCCF  jmp     short loc_58DCD3
0058DCD1  xor     ebx, ebx
0058DCD3  mov     ecx, [ebx+30h]
0058DCD6  mov     eax, [ebx+38h]
0058DCD9  lea     edi, [ebx+28h]
0058DCDC  cmp     eax, ecx
0058DCDE  mov     [esp+0B0h+var_70], ebx
0058DCE2  jl      short loc_58DD06
0058DCE4  mov     al, [edi+0Dh]
0058DCE7  test    al, al
0058DCE9  jnz     short loc_58DCEF
0058DCEB  test    ecx, ecx
0058DCED  jnz     short loc_58DD15
0058DCEF  mov     eax, [edi+14h]
0058DCF2  test    eax, eax
0058DCF4  jle     short loc_58DD15
0058DCF6  mov     edx, [edi]
0058DCF8  add     eax, ecx
0058DCFA  push    0
0058DCFC  push    eax
0058DCFD  mov     ecx, edi
0058DCFF  call    dword ptr [edx+8]
0058DD02  test    al, al
0058DD04  jz      short loc_58DD15
0058DD06  mov     eax, [edi+10h]
0058DD09  mov     edx, [edi+4]
0058DD0C  lea     ecx, [eax+1]
0058DD0F  mov     [edi+10h], ecx
0058DD12  mov     [edx+eax*4], ebp
0058DD15  mov     edx, [ebx+0Ch]
0058DD18  inc     edx
0058DD19  mov     [ebx+0Ch], edx
0058DD1C  mov     eax, [esp+0B0h+var_2C]
0058DD23  cmp     [esp+0B0h+var_24], eax
0058DD2A  jl      short loc_58DD60
0058DD2C  mov     cl, byte ptr [esp+0B0h+var_28+1]
0058DD33  test    cl, cl
0058DD35  jnz     short loc_58DD3B
0058DD37  test    eax, eax
0058DD39  jnz     short loc_58DD7B
0058DD3B  mov     ecx, [esp+0B0h+var_20]
0058DD42  test    ecx, ecx
0058DD44  jle     short loc_58DD7B
0058DD46  add     eax, ecx
0058DD48  push    0
0058DD4A  push    eax
0058DD4B  mov     eax, [esp+0B8h+var_34]
0058DD52  lea     ecx, [esp+0B8h+var_34]
0058DD59  call    dword ptr [eax+8]
0058DD5C  test    al, al
0058DD5E  jz      short loc_58DD7B
0058DD60  mov     ecx, [esp+0B0h+var_24]
0058DD67  mov     eax, ecx
0058DD69  inc     ecx
0058DD6A  mov     [esp+0B0h+var_24], ecx
0058DD71  mov     ecx, [esp+0B0h+var_30]
0058DD78  mov     [ecx+eax*4], ebx
0058DD7B  mov     eax, dword_ABED10
0058DD80  mov     edx, [ebx+8]
0058DD83  push    0
0058DD85  push    0
0058DD87  lea     ecx, [esp+0B8h+var_9C]
0058DD8B  mov     [esi+eax+38h], edx
0058DD8F  call    sub_42FCB0
0058DD94  mov     eax, dword ptr [esp+0B0h+var_94]
0058DD98  mov     [esp+0B0h+var_9C], offset ??_7?$DynamicVectorClass@VCell@@@@6B@; const DynamicVectorClass<Cell>::`vftable'
0058DDA0  test    eax, eax
0058DDA2  mov     [esp+0B0h+var_8C], 0
0058DDAA  mov     [esp+0B0h+var_88], 186A0h
0058DDB2  jg      short loc_58DDD6
0058DDB4  mov     cl, byte ptr [esp+0B0h+var_94+5]
0058DDB8  test    cl, cl
0058DDBA  jnz     short loc_58DDC0
0058DDBC  test    eax, eax
0058DDBE  jnz     short loc_58DDE8
0058DDC0  add     eax, 186A0h
0058DDC5  push    0
0058DDC7  push    eax
0058DDC8  lea     ecx, [esp+0B8h+var_9C]
0058DDCC  call    ds:off_7E3898
0058DDD2  test    al, al
0058DDD4  jz      short loc_58DDE8
0058DDD6  mov     ecx, [esp+0B0h+var_8C]
0058DDDA  mov     eax, ecx
0058DDDC  inc     ecx
0058DDDD  mov     [esp+0B0h+var_8C], ecx
0058DDE1  mov     ecx, [esp+0B0h+var_98]
0058DDE5  mov     [ecx+eax*4], ebp
0058DDE8  mov     edx, [esp+0B0h+var_8C]
0058DDEC  mov     eax, edx
0058DDEE  test    eax, eax
0058DDF0  jz      loc_58DF5B
0058DDF6  mov     ecx, [esp+0B0h+var_98]
0058DDFA  dec     eax
0058DDFB  cmp     eax, edx
0058DDFD  mov     esi, [ecx+eax*4]
0058DE00  mov     dword ptr [esp+0B0h+var_68], esi
0058DE04  jge     short loc_58DE25
0058DE06  dec     edx
0058DE07  cmp     eax, edx
0058DE09  mov     [esp+0B0h+var_8C], edx
0058DE0D  jge     short loc_58DE25
0058DE0F  jmp     short loc_58DE15
0058DE11  mov     ecx, [esp+0B0h+var_98]
0058DE15  mov     edx, [ecx+eax*4+4]
0058DE19  mov     [ecx+eax*4], edx
0058DE1C  mov     ecx, [esp+0B0h+var_8C]
0058DE20  inc     eax
0058DE21  cmp     eax, ecx
0058DE23  jl      short loc_58DE11
0058DE25  xor     eax, eax
0058DE27  mov     [esp+0B0h+var_A0], eax
0058DE2B  and     eax, 7
0058DE2E  lea     ecx, [esp+0B0h+var_48]
0058DE32  lea     eax, ds:89F688h[eax*4]
0058DE39  push    eax
0058DE3A  push    ecx
0058DE3B  lea     ecx, [esp+0B8h+var_68]
0058DE3F  call    sub_42D510
0058DE44  mov     ebx, [eax]
0058DE46  mov     esi, dword_ABED04
0058DE4C  mov     dword ptr [esp+0B0h+var_58], ebx
0058DE50  movsx   eax, word ptr [esp+0B0h+var_58+2]
0058DE55  movsx   ecx, bx
0058DE58  lea     edx, [eax+ecx]
0058DE5B  cmp     edx, esi
0058DE5D  jle     loc_58DF3B
0058DE63  mov     ebp, ecx
0058DE65  sub     ebp, eax
0058DE67  cmp     ebp, esi
0058DE69  jge     loc_58DF3B
0058DE6F  mov     ebp, eax
0058DE71  sub     ebp, ecx
0058DE73  cmp     ebp, esi
0058DE75  jge     loc_58DF3B
0058DE7B  cmp     edx, dword_ABED08
0058DE81  jg      loc_58DF3B
0058DE87  imul    eax, dword_89C2DC
0058DE8E  add     eax, ecx
0058DE90  mov     ecx, dword_ABED10
0058DE96  mov     edx, dword ptr [esp+0B0h+var_3C]
0058DE9A  lea     esi, [eax+eax*4]
0058DE9D  shl     esi, 4
0058DEA0  add     esi, ecx
0058DEA2  cmp     [esi+38h], edx
0058DEA5  jnz     loc_58DF3B
0058DEAB  mov     ecx, [edi+8]
0058DEAE  mov     eax, [edi+10h]
0058DEB1  cmp     eax, ecx
0058DEB3  jl      short loc_58DED7
0058DEB5  mov     al, [edi+0Dh]
0058DEB8  test    al, al
0058DEBA  jnz     short loc_58DEC0
0058DEBC  test    ecx, ecx
0058DEBE  jnz     short loc_58DEE6
0058DEC0  mov     eax, [edi+14h]
0058DEC3  test    eax, eax
0058DEC5  jle     short loc_58DEE6
0058DEC7  mov     edx, [edi]
0058DEC9  add     ecx, eax
0058DECB  push    0
0058DECD  push    ecx
0058DECE  mov     ecx, edi
0058DED0  call    dword ptr [edx+8]
0058DED3  test    al, al
0058DED5  jz      short loc_58DEE6
0058DED7  mov     eax, [edi+10h]
0058DEDA  mov     edx, [edi+4]
0058DEDD  lea     ecx, [eax+1]
0058DEE0  mov     [edi+10h], ecx
0058DEE3  mov     [edx+eax*4], ebx
0058DEE6  mov     eax, [esp+0B0h+var_70]
0058DEEA  mov     edx, [eax+0Ch]
0058DEED  inc     edx
0058DEEE  mov     [eax+0Ch], edx
0058DEF1  mov     eax, [eax+8]
0058DEF4  mov     [esi+38h], eax
0058DEF7  mov     eax, dword ptr [esp+0B0h+var_94]
0058DEFB  cmp     [esp+0B0h+var_8C], eax
0058DEFF  jl      short loc_58DF29
0058DF01  mov     cl, byte ptr [esp+0B0h+var_94+5]
0058DF05  test    cl, cl
0058DF07  jnz     short loc_58DF0D
0058DF09  test    eax, eax
0058DF0B  jnz     short loc_58DF3B
0058DF0D  mov     ecx, [esp+0B0h+var_88]
0058DF11  test    ecx, ecx
0058DF13  jle     short loc_58DF3B
0058DF15  mov     edx, [esp+0B0h+var_9C]
0058DF19  add     eax, ecx
0058DF1B  push    0
0058DF1D  push    eax
0058DF1E  lea     ecx, [esp+0B8h+var_9C]
0058DF22  call    dword ptr [edx+8]
0058DF25  test    al, al
0058DF27  jz      short loc_58DF3B
0058DF29  mov     ecx, [esp+0B0h+var_8C]
0058DF2D  mov     eax, ecx
0058DF2F  inc     ecx
0058DF30  mov     [esp+0B0h+var_8C], ecx
0058DF34  mov     ecx, [esp+0B0h+var_98]
0058DF38  mov     [ecx+eax*4], ebx
0058DF3B  mov     eax, [esp+0B0h+var_A0]
0058DF3F  inc     eax
0058DF40  cmp     eax, 8
0058DF43  mov     [esp+0B0h+var_A0], eax
0058DF47  jl      loc_58DE2B
0058DF4D  mov     edx, [esp+0B0h+var_8C]
0058DF51  mov     eax, edx
0058DF53  test    eax, eax
0058DF55  jnz     loc_58DDF6
0058DF5B  lea     ecx, [esp+0B0h+var_9C]
0058DF5F  mov     [esp+0B0h+var_9C], offset ??_7?$VectorClass@VCell@@@@6B@; const VectorClass<Cell>::`vftable'
0058DF67  call    sub_42F7C0
0058DF6C  mov     ecx, dword_ABED10
0058DF72  mov     ebx, [esp+0B0h+var_60]
0058DF76  mov     edx, [esp+0B0h+var_84]
0058DF7A  dec     edx
0058DF7B  mov     [esp+0B0h+var_84], edx
0058DF7F  jns     loc_58DC83
0058DF85  mov     edx, [esp+0B0h+var_24]
0058DF8C  lea     eax, [edx-1]
0058DF8F  test    eax, eax
0058DF91  mov     [esp+0B0h+var_84], eax
0058DF95  jl      loc_58E513
0058DF9B  jmp     short loc_58DFA1
0058DF9D  mov     eax, [esp+0B0h+var_84]
0058DFA1  mov     ecx, [esp+0B0h+var_30]
0058DFA8  mov     eax, [ecx+eax*4]
0058DFAB  mov     [esp+0B0h+Block], eax
0058DFAF  mov     cl, [eax+24h]
0058DFB2  test    cl, cl
0058DFB4  jnz     loc_58E500
0058DFBA  mov     ecx, eax
0058DFBC  call    sub_58E5D0
0058DFC1  mov     edx, dword_ABED14
0058DFC7  mov     ebx, eax
0058DFC9  push    edx; Size
0058DFCA  call    ??2@YAPAXI@Z; operator new(uint)
0058DFCF  mov     edx, dword_ABED14
0058DFD5  mov     ecx, eax
0058DFD7  add     esp, 4
0058DFDA  xor     eax, eax
0058DFDC  test    edx, edx
0058DFDE  mov     [esp+0B0h+var_70], ecx
0058DFE2  jle     short loc_58DFF3
0058DFE4  mov     byte ptr [ecx+eax], 0
0058DFE8  mov     edx, dword_ABED14
0058DFEE  inc     eax
0058DFEF  cmp     eax, edx
0058DFF1  jl      short loc_58DFE4
0058DFF3  mov     eax, [ebx+10h]
0058DFF6  dec     eax
0058DFF7  mov     [esp+0B0h+var_A0], eax
0058DFFB  js      loc_58E0A2
0058E001  mov     ecx, [ebx+4]
0058E004  xor     edi, edi
0058E006  mov     edx, [ecx+eax*4]
0058E009  mov     dword ptr [esp+0B0h+var_58], edx
0058E00D  mov     eax, edi
0058E00F  lea     edx, [esp+0B0h+var_48]
0058E013  and     eax, 7
0058E016  lea     ecx, ds:89F688h[eax*4]
0058E01D  push    ecx
0058E01E  push    edx
0058E01F  lea     ecx, [esp+0B8h+var_58]
0058E023  call    sub_42D510
0058E028  mov     eax, [eax]
0058E02A  mov     esi, dword_ABED04
0058E030  mov     dword ptr [esp+0B0h+var_68], eax
0058E034  movsx   ecx, ax
0058E037  movsx   eax, word ptr [esp+0B0h+var_68+2]
0058E03C  lea     edx, [eax+ecx]
0058E03F  cmp     edx, esi
0058E041  jle     short loc_58E089
0058E043  mov     ebp, ecx
0058E045  sub     ebp, eax
0058E047  cmp     ebp, esi
0058E049  jge     short loc_58E089
0058E04B  mov     ebp, eax
0058E04D  sub     ebp, ecx
0058E04F  cmp     ebp, esi
0058E051  jge     short loc_58E089
0058E053  cmp     edx, dword_ABED08
0058E059  jg      short loc_58E089
0058E05B  imul    eax, dword_89C2DC
0058E062  add     eax, ecx
0058E064  mov     ecx, dword_ABED10
0058E06A  lea     eax, [eax+eax*4]
0058E06D  shl     eax, 4
0058E070  mov     eax, [eax+ecx+38h]
0058E074  test    eax, eax
0058E076  jl      short loc_58E089
0058E078  mov     edx, [esp+0B0h+Block]
0058E07C  cmp     eax, [edx+8]
0058E07F  jz      short loc_58E089
0058E081  mov     ecx, [esp+0B0h+var_70]
0058E085  mov     byte ptr [eax+ecx], 1
0058E089  inc     edi
0058E08A  cmp     edi, 8
0058E08D  jl      loc_58E00D
0058E093  mov     eax, [esp+0B0h+var_A0]
0058E097  dec     eax
0058E098  mov     [esp+0B0h+var_A0], eax
0058E09C  jns     loc_58E001
0058E0A2  test    ebx, ebx
0058E0A4  jz      short loc_58E0AE
0058E0A6  mov     edx, [ebx]
0058E0A8  push    1
0058E0AA  mov     ecx, ebx
0058E0AC  call    dword ptr [edx]
0058E0AE  mov     eax, dword_ABED14
0058E0B3  or      ebx, 0FFFFFFFFh
0058E0B6  xor     edx, edx
0058E0B8  mov     [esp+0B0h+var_A0], 0
0058E0C0  test    eax, eax
0058E0C2  mov     [esp+0B0h+var_5C], ebx
0058E0C6  mov     [esp+0B0h+var_6C], ebx
0058E0CA  mov     esi, ebx
0058E0CC  mov     edi, ebx
0058E0CE  jle     loc_58E15D
0058E0D4  mov     ebp, dword_ABDFA0
0058E0DA  mov     eax, [esp+0B0h+var_70]
0058E0DE  cmp     byte ptr [eax+edx], 0
0058E0E2  jz      short loc_58E14F
0058E0E4  xor     eax, eax
0058E0E6  test    ebp, ebp
0058E0E8  jle     short loc_58E0FF
0058E0EA  mov     ecx, dword_ABDF94
0058E0F0  mov     ebx, [ecx]
0058E0F2  cmp     [ebx+8], edx
0058E0F5  jz      short loc_58E135
0058E0F7  inc     eax
0058E0F8  add     ecx, 4
0058E0FB  cmp     eax, ebp
0058E0FD  jl      short loc_58E0F0
0058E0FF  xor     eax, eax
0058E101  mov     cl, [eax+24h]
0058E104  test    cl, cl
0058E106  jnz     short loc_58E14F
0058E108  mov     ecx, [eax+0Ch]
0058E10B  mov     ebx, [esp+0B0h+var_6C]
0058E10F  cmp     ecx, ebx
0058E111  jle     short loc_58E129
0058E113  mov     bl, [eax+14h]
0058E116  test    bl, bl
0058E118  jnz     short loc_58E129
0058E11A  mov     [esp+0B0h+var_6C], ecx
0058E11E  mov     ecx, [eax+10h]
0058E121  mov     [esp+0B0h+var_A0], eax
0058E125  mov     [esp+0B0h+var_5C], ecx
0058E129  cmp     esi, 0FFFFFFFFh
0058E12C  jnz     short loc_58E140
0058E12E  mov     esi, [eax+10h]
0058E131  mov     edi, esi
0058E133  jmp     short loc_58E14F
0058E135  mov     ecx, dword_ABDF94
0058E13B  mov     eax, [ecx+eax*4]
0058E13E  jmp     short loc_58E101
0058E140  mov     eax, [eax+10h]
0058E143  cmp     eax, edi
0058E145  jle     short loc_58E149
0058E147  mov     edi, eax
0058E149  cmp     eax, esi
0058E14B  jge     short loc_58E14F
0058E14D  mov     esi, eax
0058E14F  mov     eax, dword_ABED14
0058E154  inc     edx
0058E155  cmp     edx, eax
0058E157  jl      short loc_58E0DA
0058E159  mov     ebx, [esp+0B0h+var_5C]
0058E15D  push    0
0058E15F  push    0
0058E161  lea     ecx, [esp+0B8h+var_9C]
0058E165  call    sub_477BE0
0058E16A  mov     eax, edi
0058E16C  mov     [esp+0B0h+var_9C], offset ??_7?$DynamicVectorClass@H@@6B@; const DynamicVectorClass<int>::`vftable'
0058E174  sub     eax, esi
0058E176  mov     [esp+0B0h+var_88], 0Ah
0058E17E  mov     [esp+0B0h+var_8C], 0
0058E186  jz      loc_58E269
0058E18C  cmp     eax, 4
0058E18F  jz      short loc_58E1EB
0058E191  cmp     eax, 8
0058E194  jnz     loc_58E2F9
0058E19A  lea     eax, [edi+esi]
0058E19D  cdq
0058E19E  sub     eax, edx
0058E1A0  mov     esi, eax
0058E1A2  mov     eax, dword ptr [esp+0B0h+var_94]
0058E1A6  sar     esi, 1
0058E1A8  test    eax, eax
0058E1AA  jg      short loc_58E1D4
0058E1AC  mov     cl, byte ptr [esp+0B0h+var_94+5]
0058E1B0  test    cl, cl
0058E1B2  jnz     short loc_58E1BC
0058E1B4  test    eax, eax
0058E1B6  jnz     loc_58E2F9
0058E1BC  add     eax, 0Ah
0058E1BF  push    0
0058E1C1  push    eax
0058E1C2  lea     ecx, [esp+0B8h+var_9C]
0058E1C6  call    ds:off_7E4E80
0058E1CC  test    al, al
0058E1CE  jz      loc_58E2F9
0058E1D4  mov     ecx, [esp+0B0h+var_8C]
0058E1D8  mov     edx, [esp+0B0h+var_98]
0058E1DC  mov     eax, ecx
0058E1DE  inc     ecx
0058E1DF  mov     [esp+0B0h+var_8C], ecx
0058E1E3  mov     [edx+eax*4], esi
0058E1E6  jmp     loc_58E2F9
0058E1EB  mov     eax, dword ptr [esp+0B0h+var_94]
0058E1EF  test    eax, eax
0058E1F1  jg      short loc_58E213
0058E1F3  mov     cl, byte ptr [esp+0B0h+var_94+5]
0058E1F7  test    cl, cl
0058E1F9  jnz     short loc_58E1FF
0058E1FB  test    eax, eax
0058E1FD  jnz     short loc_58E229
0058E1FF  add     eax, 0Ah
0058E202  push    0
0058E204  push    eax
0058E205  lea     ecx, [esp+0B8h+var_9C]
0058E209  call    ds:off_7E4E80
0058E20F  test    al, al
0058E211  jz      short loc_58E225
0058E213  mov     ecx, [esp+0B0h+var_8C]
0058E217  mov     eax, ecx
0058E219  inc     ecx
0058E21A  mov     [esp+0B0h+var_8C], ecx
0058E21E  mov     ecx, [esp+0B0h+var_98]
0058E222  mov     [ecx+eax*4], edi
0058E225  mov     eax, dword ptr [esp+0B0h+var_94]
0058E229  cmp     [esp+0B0h+var_8C], eax
0058E22D  jl      loc_58E2E7
0058E233  mov     cl, byte ptr [esp+0B0h+var_94+5]
0058E237  test    cl, cl
0058E239  jnz     short loc_58E243
0058E23B  test    eax, eax
0058E23D  jnz     loc_58E2F9
0058E243  mov     ecx, [esp+0B0h+var_88]
0058E247  test    ecx, ecx
0058E249  jle     loc_58E2F9
0058E24F  mov     edx, [esp+0B0h+var_9C]
0058E253  add     eax, ecx
0058E255  push    0
0058E257  push    eax
0058E258  lea     ecx, [esp+0B8h+var_9C]
0058E25C  call    dword ptr [edx+8]
0058E25F  test    al, al
0058E261  jz      loc_58E2F9
0058E267  jmp     short loc_58E2E7
0058E269  cmp     esi, 4
0058E26C  jl      short loc_58E2AB
0058E26E  mov     eax, dword ptr [esp+0B0h+var_94]
0058E272  add     esi, 0FFFFFFFCh
0058E275  test    eax, eax
0058E277  jg      short loc_58E299
0058E279  mov     cl, byte ptr [esp+0B0h+var_94+5]
0058E27D  test    cl, cl
0058E27F  jnz     short loc_58E285
0058E281  test    eax, eax
0058E283  jnz     short loc_58E2AF
0058E285  add     eax, 0Ah
0058E288  push    0
0058E28A  push    eax
0058E28B  lea     ecx, [esp+0B8h+var_9C]
0058E28F  call    ds:off_7E4E80
0058E295  test    al, al
0058E297  jz      short loc_58E2AB
0058E299  mov     ecx, [esp+0B0h+var_8C]
0058E29D  mov     edx, [esp+0B0h+var_98]
0058E2A1  mov     eax, ecx
0058E2A3  inc     ecx
0058E2A4  mov     [esp+0B0h+var_8C], ecx
0058E2A8  mov     [edx+eax*4], esi
0058E2AB  mov     eax, dword ptr [esp+0B0h+var_94]
0058E2AF  cmp     edi, 7
0058E2B2  jg      short loc_58E2F9
0058E2B4  mov     ecx, [esp+0B0h+var_8C]
0058E2B8  lea     esi, [edi+4]
0058E2BB  cmp     ecx, eax
0058E2BD  jl      short loc_58E2E7
0058E2BF  mov     cl, byte ptr [esp+0B0h+var_94+5]
0058E2C3  test    cl, cl
0058E2C5  jnz     short loc_58E2CB
0058E2C7  test    eax, eax
0058E2C9  jnz     short loc_58E2F9
0058E2CB  mov     ecx, [esp+0B0h+var_88]
0058E2CF  test    ecx, ecx
0058E2D1  jle     short loc_58E2F9
0058E2D3  add     eax, ecx
0058E2D5  push    0
0058E2D7  push    eax
0058E2D8  mov     eax, [esp+0B8h+var_9C]
0058E2DC  lea     ecx, [esp+0B8h+var_9C]
0058E2E0  call    dword ptr [eax+8]
0058E2E3  test    al, al
0058E2E5  jz      short loc_58E2F9
0058E2E7  mov     ecx, [esp+0B0h+var_8C]
0058E2EB  mov     eax, ecx
0058E2ED  inc     ecx
0058E2EE  mov     [esp+0B0h+var_8C], ecx
0058E2F2  mov     ecx, [esp+0B0h+var_98]
0058E2F6  mov     [ecx+eax*4], esi
0058E2F9  mov     eax, dword_ABE014
0058E2FE  cmp     eax, 3
0058E301  jz      short loc_58E308
0058E303  cmp     eax, 4
0058E306  jnz     short loc_58E343
0058E308  mov     esi, [esp+0B0h+var_8C]
0058E30C  lea     edx, [esi-1]
0058E30F  test    edx, edx
0058E311  jl      short loc_58E343
0058E313  mov     ecx, [esp+0B0h+var_98]
0058E317  cmp     dword ptr [ecx+edx*4], 0
0058E31B  jnz     short loc_58E340
0058E31D  cmp     edx, esi
0058E31F  jge     short loc_58E340
0058E321  dec     esi
0058E322  mov     eax, edx
0058E324  cmp     edx, esi
0058E326  mov     [esp+0B0h+var_8C], esi
0058E32A  jge     short loc_58E340
0058E32C  mov     esi, [ecx+eax*4+4]
0058E330  mov     [ecx+eax*4], esi
0058E333  mov     esi, [esp+0B0h+var_8C]
0058E337  mov     ecx, [esp+0B0h+var_98]
0058E33B  inc     eax
0058E33C  cmp     eax, esi
0058E33E  jl      short loc_58E32C
0058E340  dec     edx
0058E341  jns     short loc_58E317
0058E343  mov     edx, [esp+0B0h+var_70]
0058E347  push    edx; Block
0058E348  call    ??3@YAXPAX@Z; operator delete(void *)
0058E34D  mov     eax, [esp+0B4h+Block]
0058E351  add     esp, 4
0058E354  cmp     dword ptr [eax+0Ch], 64h ; 'd'
0058E358  jle     loc_58E40A
0058E35E  mov     edi, [eax+10h]
0058E361  mov     eax, [esp+0B0h+var_8C]
0058E365  xor     ebp, ebp
0058E367  lea     esi, [eax-1]
0058E36A  mov     dword ptr [esp+0B0h+var_80+4], ebp
0058E36E  lea     ecx, [esi+1]
0058E371  mov     dword ptr [esp+0B0h+var_80], ecx
0058E375  fild    [esp+0B0h+var_80]
0058E379  fstp    [esp+0B0h+var_68]
0058E37D  mov     ecx, offset unk_ABE890
0058E382  call    sub_65C780
0058E387  mov     dword ptr [esp+0B0h+var_3C], eax
0058E38B  mov     dword ptr [esp+0B0h+var_3C+4], ebp
0058E38F  fild    [esp+0B0h+var_3C]
0058E393  fmul    [esp+0B0h+var_68]
0058E397  fmul    ds:dbl_7ED898
0058E39D  call    sub_7C5F00
0058E3A2  cmp     eax, esi
0058E3A4  ja      short loc_58E37D
0058E3A6  mov     edx, [esp+0B0h+var_98]
0058E3AA  mov     ecx, [esp+0B0h+Block]
0058E3AE  mov     eax, [edx+eax*4]
0058E3B1  mov     [ecx+10h], eax
0058E3B4  sub     eax, edi
0058E3B6  mov     ecx, offset stru_87F7E8
0058E3BB  mov     ebx, eax
0058E3BD  call    sub_578350
0058E3C2  mov     ecx, offset stru_87F7E8
0058E3C7  call    sub_578290
0058E3CC  mov     esi, eax
0058E3CE  cmp     esi, ebp
0058E3D0  jz      loc_58E4EF
0058E3D6  mov     edi, [esp+0B0h+Block]
0058E3DA  mov     edx, [esi+24h]
0058E3DD  lea     ecx, [esp+0B0h+var_68]
0058E3E1  mov     dword ptr [esp+0B0h+var_68], edx
0058E3E5  call    sub_58D0A0
0058E3EA  cmp     eax, [edi+8]
0058E3ED  jnz     short loc_58E3F5
0058E3EF  add     [esi+11Bh], bl
0058E3F5  mov     ecx, offset stru_87F7E8
0058E3FA  call    sub_578290
0058E3FF  mov     esi, eax
0058E401  cmp     esi, ebp
0058E403  jnz     short loc_58E3DA
0058E405  jmp     loc_58E4EF
0058E40A  mov     eax, [esp+0B0h+var_A0]
0058E40E  test    eax, eax
0058E410  jz      loc_58E4EF
0058E416  mov     ebp, [esp+0B0h+Block]
0058E41A  mov     ecx, offset stru_87F7E8
0058E41F  mov     eax, [ebp+10h]
0058E422  mov     [ebp+10h], ebx
0058E425  sub     ebx, eax
0058E427  call    sub_578350
0058E42C  mov     ecx, offset stru_87F7E8
0058E431  call    sub_578290
0058E436  mov     esi, eax
0058E438  test    esi, esi
0058E43A  jz      short loc_58E467
0058E43C  mov     eax, [esi+24h]
0058E43F  lea     ecx, [esp+0B0h+var_68]
0058E443  mov     dword ptr [esp+0B0h+var_68], eax
0058E447  call    sub_58D0A0
0058E44C  cmp     eax, [ebp+8]
0058E44F  jnz     short loc_58E457
0058E451  add     [esi+11Bh], bl
0058E457  mov     ecx, offset stru_87F7E8
0058E45C  call    sub_578290
0058E461  mov     esi, eax
0058E463  test    esi, esi
0058E465  jnz     short loc_58E43C
0058E467  mov     ebx, [ebp+38h]
0058E46A  dec     ebx
0058E46B  js      short loc_58E4EB
0058E46D  mov     ecx, [esp+0B0h+var_A0]
0058E471  lea     esi, [ecx+28h]
0058E474  mov     edx, [ebp+2Ch]
0058E477  mov     eax, [esi+8]
0058E47A  mov     ecx, [esi+10h]
0058E47D  mov     edi, [edx+ebx*4]
0058E480  cmp     ecx, eax
0058E482  mov     dword ptr [esp+0B0h+var_68], edi
0058E486  jl      short loc_58E4AA
0058E488  mov     cl, [esi+0Dh]
0058E48B  test    cl, cl
0058E48D  jnz     short loc_58E493
0058E48F  test    eax, eax
0058E491  jnz     short loc_58E4B9
0058E493  mov     ecx, [esi+14h]
0058E496  test    ecx, ecx
0058E498  jle     short loc_58E4B9
0058E49A  mov     edx, [esi]
0058E49C  add     eax, ecx
0058E49E  push    0
0058E4A0  push    eax
0058E4A1  mov     ecx, esi
0058E4A3  call    dword ptr [edx+8]
0058E4A6  test    al, al
0058E4A8  jz      short loc_58E4B9
0058E4AA  mov     eax, [esi+10h]
0058E4AD  mov     edx, [esi+4]
0058E4B0  lea     ecx, [eax+1]
0058E4B3  mov     [esi+10h], ecx
0058E4B6  mov     [edx+eax*4], edi
0058E4B9  mov     ecx, [esp+0B0h+var_A0]
0058E4BD  movsx   edx, di
0058E4C0  mov     eax, [ecx+0Ch]
0058E4C3  inc     eax
0058E4C4  mov     [ecx+0Ch], eax
0058E4C7  mov     ecx, [ecx+8]
0058E4CA  movsx   eax, word ptr [esp+0B0h+var_68+2]
0058E4CF  imul    eax, dword_89C2DC
0058E4D6  add     eax, edx
0058E4D8  mov     edx, dword_ABED10
0058E4DE  lea     eax, [eax+eax*4]
0058E4E1  shl     eax, 4
0058E4E4  dec     ebx
0058E4E5  mov     [eax+edx+38h], ecx
0058E4E9  jns     short loc_58E474
0058E4EB  mov     byte ptr [ebp+24h], 1
0058E4EF  lea     ecx, [esp+0B0h+var_9C]
0058E4F3  mov     [esp+0B0h+var_9C], offset ??_7?$VectorClass@H@@6B@; const VectorClass<int>::`vftable'
0058E4FB  call    sub_477D20
0058E500  mov     eax, [esp+0B0h+var_84]
0058E504  dec     eax
0058E505  mov     [esp+0B0h+var_84], eax
0058E509  jns     loc_58DF9D
0058E50F  mov     ebx, [esp+0B0h+var_60]
0058E513  mov     eax, dword_ABDFA0
0058E518  xor     ebp, ebp
0058E51A  lea     edi, [eax-1]
0058E51D  cmp     edi, ebp
0058E51F  jl      short loc_58E554
0058E521  mov     ecx, dword_ABDF94
0058E527  mov     eax, [ecx+edi*4]
0058E52A  cmp     eax, ebx
0058E52C  jz      short loc_58E551
0058E52E  mov     dl, [eax+24h]
0058E531  test    dl, dl
0058E533  jz      short loc_58E551
0058E535  mov     esi, eax
0058E537  cmp     esi, ebp
0058E539  jz      short loc_58E551
0058E53B  mov     ecx, esi
0058E53D  call    sub_58C070
0058E542  push    esi; Block
0058E543  call    ??3@YAXPAX@Z; operator delete(void *)
0058E548  mov     ecx, dword_ABDF94
0058E54E  add     esp, 4
0058E551  dec     edi
0058E552  jns     short loc_58E527
0058E554  mov     edx, [ebx+1Ch]
0058E557  mov     eax, [esp+0B0h+var_30]
0058E55E  inc     edx
0058E55F  cmp     eax, ebp
0058E561  mov     [ebx+1Ch], edx
0058E564  mov     [esp+0B0h+var_34], offset ??_7?$VectorClass@PAVMapRegionClass@@@@6B@; const VectorClass<MapRegionClass *>::`vftable'
0058E56C  jz      short loc_58E589
0058E56E  mov     cl, byte ptr [esp+0B0h+var_28+1]
0058E575  test    cl, cl
0058E577  jz      short loc_58E589
0058E579  push    eax; Block
0058E57A  call    ??3@YAXPAX@Z; operator delete(void *)
0058E57F  add     esp, 4
0058E582  mov     [esp+0B0h+var_30], ebp
0058E589  mov     eax, [esp+0B0h+var_14]
0058E590  mov     byte ptr [esp+0B0h+var_28+1], 0
0058E598  cmp     eax, ebp
0058E59A  mov     [esp+0B0h+var_2C], ebp
0058E5A1  mov     [esp+0B0h+var_18], offset ??_7?$VectorClass@VCell@@@@6B@; const VectorClass<Cell>::`vftable'
0058E5AC  jz      short loc_58E5C2
0058E5AE  mov     cl, [esp+0B0h+var_B]
0058E5B5  test    cl, cl
0058E5B7  jz      short loc_58E5C2
0058E5B9  push    eax; Block
0058E5BA  call    ??3@YAXPAX@Z; operator delete(void *)
0058E5BF  add     esp, 4
0058E5C2  pop     edi
0058E5C3  mov     al, 1
0058E5C5  pop     esi
0058E5C6  pop     ebp
0058E5C7  pop     ebx
0058E5C8  mov     esp, ebp
0058E5CA  pop     ebp
0058E5CB  retn