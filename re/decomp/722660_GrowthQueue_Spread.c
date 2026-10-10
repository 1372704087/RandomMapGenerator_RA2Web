void __thiscall sub_722440(int this)
{
  int v1; // ebx
  int *v2; // eax
  int v3; // eax
  int v4; // esi
  int v5; // et2
  int v6; // esi
  int v7; // edi
  int *v8; // ecx
  __int16 *v9; // eax
  int v10; // eax
  __int16 *v11; // esi
  int v12; // ebp
  _DWORD *v13; // esi
  signed int i; // edi
  _DWORD *v15; // eax
  _DWORD *v16; // ebp
  int v17; // eax
  _DWORD *v18; // edi
  unsigned int v19; // ecx
  unsigned int v20; // edx
  unsigned int v21; // esi
  int v22; // ecx
  int v23; // ebp
  unsigned int v24; // eax
  int *v25; // ecx
  int v26; // eax
  int v27; // edi
  __int16 *v28; // esi
  int v29; // esi
  int v30; // edx
  int v31; // eax
  int v32; // esi
  int v33; // ebx
  int v34; // [esp+10h] [ebp-18h]
  float v35; // [esp+14h] [ebp-14h]
  _DWORD *v36; // [esp+18h] [ebp-10h]
  unsigned int v37; // [esp+1Ch] [ebp-Ch]
  __int16 *v38; // [esp+1Ch] [ebp-Ch]
  int v39; // [esp+20h] [ebp-8h]

  v1 = this;
  v2 = *(int **)(this + 244);
  if ( v2 != nullptr && *v2 != 0 && *(double *)(this + 160) > 2.09817511832308e-307 )
  {
    v3 = sub_7C5F00((double)*v2 * *(double *)(this + 160));
    if ( v3 < 5 )
    {
      v4 = 5;
    }
    else if ( v3 <= 25 )
    {
      v4 = v3;
    }
    else
    {
      v4 = 25;
    }
    v5 = (int)abs32(sub_65C780(*(_DWORD *)&byte_A8B260 + 536)) % v4;
    v6 = **(_DWORD **)(v1 + 244);
    v7 = v5 + 1;
    v39 = v5 + 1;
    if ( v6 > sub_42B1F0() - 20 )
      sub_7228B0((int **)v1);
    v8 = *(int **)(v1 + 244);
    v34 = 0;
    if ( *v8 != 0 )
    {
      v10 = v8[2];
      v11 = *(__int16 **)(v10 + 4);
      *(_DWORD *)(v10 + 4) = *(_DWORD *)(v10 + 4 * *v8);
      *(_DWORD *)(v8[2] + 4 * (*v8)--) = 0;
      sub_5AD870(v8, 1);
      v9 = v11;
    }
    else
    {
      v9 = nullptr;
    }
    if ( v7 > 0 )
    {
      while ( 1 )
      {
        while ( 1 )
        {
          if ( v9 == nullptr )
            return;
          v12 = 0;
          v13 = sub_5657A0(&stru_87F7E8, v9);
          for ( i = 0; i < 8; ++i )
          {
            v15 = sub_481810(v13, i);
            if ( sub_4838E0((int)v15, 0) != 0 )
              ++v12;
          }
          if ( v12 != 0 )
          {
            sub_483780((int)v13, 0);
            ++v34;
            if ( v12 > 1 )
            {
              v16 = v13 + 9;
              *(_DWORD *)(*(_DWORD *)(v1 + 252) + 8 * *(_DWORD *)(v1 + 240)) = v13[9];
              v36 = v13 + 9;
              *(_DWORD *)(*(_DWORD *)(v1 + 252) + 8 * *(_DWORD *)(v1 + 240) + 4) = 0;
              v17 = *(_DWORD *)(v1 + 240);
              v18 = *(_DWORD **)(v1 + 244);
              v19 = *(_DWORD *)(v1 + 252) + 8 * v17;
              *(_DWORD *)(v1 + 240) = v17 + 1;
              v20 = *v18 + 1;
              v35 = *(float *)(v19 + 4);
              v37 = v19;
              v21 = v20 >> 1;
              if ( v20 < v18[1] )
              {
                if ( v20 > 1 )
                {
                  do
                  {
                    v22 = v18[2];
                    v23 = *(_DWORD *)(v22 + 4 * v21);
                    if ( *(float *)(v23 + 4) <= (double)v35 )
                      break;
                    *(_DWORD *)(v22 + 4 * v20) = v23;
                    v20 = v21;
                    v21 >>= 1;
                  }
                  while ( v20 > 1 );
                  v16 = v36;
                  v19 = v37;
                }
                *(_DWORD *)(v18[2] + 4 * v20) = v19;
                v24 = v18[3];
                ++*v18;
                if ( v19 > v24 )
                  v18[3] = v19;
                if ( v19 < v18[4] )
                  v18[4] = v19;
              }
              *(_BYTE *)(sub_42B1C0(v16) + *(_DWORD *)(v1 + 248)) = 1;
            }
          }
          else
          {
            *(_BYTE *)(sub_42B1C0(v13 + 9) + *(_DWORD *)(v1 + 248)) = 0;
          }
          if ( v34 >= v39 )
            return;
          v25 = *(int **)(v1 + 244);
          if ( *v25 != 0 )
            break;
          v9 = nullptr;
        }
        v26 = v25[2];
        v27 = 1;
        v28 = *(__int16 **)(v26 + 4);
        *(_DWORD *)(v26 + 4) = *(_DWORD *)(v26 + 4 * *v25);
        v38 = v28;
        *(_DWORD *)(v25[2] + 4 * *v25) = 0;
        v29 = *v25 - 1;
        *v25 = v29;
        if ( v29 < 2
          || (v30 = 2, *(float *)(*(_DWORD *)(v25[2] + 4) + 4) <= (double)*(float *)(*(_DWORD *)(v25[2] + 8) + 4)) )
        {
          v30 = 1;
        }
        if ( v29 < 3
          || *(float *)(*(_DWORD *)(v25[2] + 4 * v30) + 4) <= (double)*(float *)(*(_DWORD *)(v25[2] + 12) + 4) )
        {
          if ( v30 == 1 )
            goto LABEL_52;
        }
        else
        {
          v30 = 3;
        }
        do
        {
          v31 = v25[2];
          v32 = *(_DWORD *)(v31 + 4 * v27);
          *(_DWORD *)(v31 + 4 * v27) = *(_DWORD *)(v31 + 4 * v30);
          v27 = v30;
          v33 = 2 * v30 + 1;
          *(_DWORD *)(v25[2] + 4 * v30) = v32;
          if ( 2 * v30 <= *v25
            && *(float *)(*(_DWORD *)(v25[2] + 4 * v30) + 4) > (double)*(float *)(*(_DWORD *)(v25[2] + 8 * v30) + 4) )
          {
            v30 *= 2;
          }
          if ( v33 <= *v25
            && *(float *)(*(_DWORD *)(v25[2] + 4 * v30) + 4) > (double)*(float *)(*(_DWORD *)(v25[2] + 4 * v33) + 4) )
          {
            v30 = v33;
          }
        }
        while ( v30 != v27 );
        v1 = this;
LABEL_52:
        v9 = v38;
      }
    }
  }
}
