// 0x5a1fb0 Start_WriteFlood size=3EF

char __thiscall sub_5A1FB0(int *this)
{
  int v1; // eax
  int v2; // ebx
  int v3; // edi
  float *v4; // ebp
  int *v5; // eax
  int *v6; // esi
  void *v7; // eax
  int v8; // ecx
  int v9; // eax
  int i; // eax
  int v11; // ebx
  int v12; // eax
  bool v13; // sf
  int v14; // eax
  unsigned int v15; // ecx
  unsigned int v16; // edx
  int v17; // edi
  int v18; // ebx
  unsigned int v19; // eax
  int v20; // eax
  __int16 *v21; // edi
  char v22; // al
  float *v23; // edi
  int v24; // edx
  _DWORD *v25; // eax
  __int16 v26; // ax
  int v27; // ecx
  int v28; // edx
  double v29; // st7
  int v30; // eax
  unsigned int v31; // ebp
  float v32; // eax
  unsigned int v33; // ecx
  unsigned int v34; // edx
  int v35; // ebx
  unsigned int v36; // eax
  int v37; // eax
  int v39; // [esp+1Ch] [ebp-3Ch] BYREF
  int v40; // [esp+20h] [ebp-38h]
  int v41; // [esp+24h] [ebp-34h]
  __int16 *v42; // [esp+28h] [ebp-30h]
  int v43; // [esp+2Ch] [ebp-2Ch]
  int v44; // [esp+30h] [ebp-28h]
  float *v45; // [esp+34h] [ebp-24h]
  int v46; // [esp+38h] [ebp-20h]
  float v47; // [esp+3Ch] [ebp-1Ch]
  int v48; // [esp+40h] [ebp-18h]
  int v49; // [esp+44h] [ebp-14h]
  float v50; // [esp+48h] [ebp-10h]
  int *v51; // [esp+4Ch] [ebp-Ch]
  char v52[4]; // [esp+50h] [ebp-8h] BYREF
  char v53[4]; // [esp+54h] [ebp-4h] BYREF

  v1 = *(this + 20);
  v2 = 0;
  v51 = this;
  if ( v1 > 0 )
  {
    do
    {
      v3 = *sub_68BCC0((char *)dword_A8B230, v52, v2);
      v43 = v3;
      v4 = (float *)operator new(0x1900u);
      v45 = v4;
      v5 = (int *)operator new(0x14u);
      v6 = v5;
      if ( v5 != nullptr )
      {
        v5[3] = 0;
        v5[4] = -1;
        *v5 = 0;
        v5[1] = 800;
        v7 = operator new(0xC84u);
        v8 = v6[1];
        v6[2] = (int)v7;
        v9 = 0;
        if ( v8 >= 0 )
        {
          do
          {
            ++v9;
            *(_DWORD *)(v6[2] + 4 * v9 - 4) = 0;
          }
          while ( v9 <= v6[1] );
        }
      }
      else
      {
        v6 = nullptr;
      }
      sub_578350(&stru_87F7E8);
      for ( i = sub_578290(&stru_87F7E8); i != 0; i = sub_578290(&stru_87F7E8) )
      {
        v46 = *(_DWORD *)(i + 36);
        *((_DWORD *)dword_ABED10 + 20 * (__int16)v46 + 20 * dword_89C2DC * SHIWORD(v46) + 15) = 0;
      }
      v11 = v2 + 1;
      v12 = 0;
      v13 = *v6 < 0;
      v41 = 0;
      v46 = v11;
      if ( !v13 )
      {
        do
        {
          ++v12;
          *(_DWORD *)(v6[2] + 4 * v12 - 4) = 0;
        }
        while ( v12 <= *v6 );
      }
      v14 = SHIWORD(v43);
      *v6 = 0;
      *(_DWORD *)v4 = v3;
      v4[1] = 0.0;
      v49 = (__int16)v3;
      v40 = 1;
      *((_DWORD *)dword_ABED10 + 20 * (__int16)v3 + 20 * dword_89C2DC * v14 + 15) = v11;
      v15 = *v6 + 1;
      v47 = v4[1];
      v16 = v15 >> 1;
      if ( v15 < v6[1] )
      {
        for ( ; v15 > 1; v16 >>= 1 )
        {
          v17 = v6[2];
          v18 = *(_DWORD *)(v17 + 4 * v16);
          if ( *(float *)(v18 + 4) <= (double)v47 )
            break;
          *(_DWORD *)(v17 + 4 * v15) = v18;
          v15 = v16;
        }
        *(_DWORD *)(v6[2] + 4 * v15) = v4;
        v19 = v6[3];
        ++*v6;
        if ( (unsigned int)v4 > v19 )
          v6[3] = (int)v4;
        if ( (unsigned int)v4 < v6[4] )
          v6[4] = (int)v4;
      }
      if ( *v6 != 0 )
      {
        v20 = v6[2];
        v21 = *(__int16 **)(v20 + 4);
        *(_DWORD *)(v20 + 4) = *(_DWORD *)(v20 + 4 * *v6);
        *(_DWORD *)(v6[2] + 4 * (*v6)--) = 0;
        sub_5AD870(1);
        v42 = v21;
        if ( v21 != nullptr )
        {
          do
          {
            if ( v41 >= 400 )
              break;
            *((_BYTE *)dword_ABED10 + 80 * *v42 + 80 * dword_89C2DC * v42[1] + 69) = 1;
            v22 = 0;
            v44 = 0;
            v23 = &v4[2 * v40];
            do
            {
              v48 = *(_DWORD *)sub_42D510(v53, 4 * (v22 & 7) + 9041544);
              v39 = v48;
              v24 = SHIWORD(v48) + (__int16)v48;
              if ( v24 > dword_ABED04
                && (__int16)v48 - SHIWORD(v48) < dword_ABED04
                && SHIWORD(v48) - (__int16)v48 < dword_ABED04
                && v24 <= dword_ABED08
                && *((_DWORD *)dword_ABED10 + 20 * (__int16)v48 + 20 * dword_89C2DC * SHIWORD(v48) + 15) == 0 )
              {
                v25 = (_DWORD *)sub_5657A0(&v39);
                if ( sub_486380(v25) )
                {
                  v26 = v39;
                  v27 = v49;
                  v28 = SHIWORD(v43);
                  *(_DWORD *)v23 = v39;
                  v48 = (v26 - v27) * (v26 - v27) + (SHIWORD(v39) - v28) * (SHIWORD(v39) - v28);
                  v29 = (double)v48;
                  sub_4CAC40(v29);
                  v30 = SHIWORD(v39);
                  v23[1] = v29;
                  v31 = (unsigned int)v23;
                  v23 += 2;
                  *((_DWORD *)dword_ABED10 + 20 * (__int16)v39 + 20 * dword_89C2DC * v30 + 15) = v46;
                  v32 = *(float *)(v31 + 4);
                  v33 = *v6 + 1;
                  ++v40;
                  v50 = v32;
                  v34 = v33 >> 1;
                  if ( v33 < v6[1] )
                  {
                    for ( ; v33 > 1; v34 >>= 1 )
                    {
                      v35 = v6[2];
                      if ( *(float *)(*(_DWORD *)(v35 + 4 * v34) + 4) <= (double)v50 )
                        break;
                      *(_DWORD *)(v35 + 4 * v33) = *(_DWORD *)(v35 + 4 * v34);
                      v33 = v34;
                    }
                    *(_DWORD *)(v6[2] + 4 * v33) = v31;
                    v36 = v6[3];
                    ++*v6;
                    if ( v31 > v36 )
                      v6[3] = v31;
                    if ( v31 < v6[4] )
                      v6[4] = v31;
                  }
                }
              }
              v22 = ++v44;
            }
            while ( v44 < 8 );
            ++v41;
            v37 = sub_5AC960(v6);
            v4 = v45;
            v42 = (__int16 *)v37;
          }
          while ( v37 != 0 );
        }
      }
      operator delete(v4);
      if ( v6 != nullptr )
        sub_5AC340(v6, 1);
      v2 = v46;
    }
    while ( v46 < v51[20] );
  }
  return 1;
}
